"""Viago local-only GPS -> road routing -> GeoJSON contract."""
from __future__ import annotations

from django.conf import settings
from django.db import DatabaseError, connections
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .gps_route import GPSRouteValidationError, GPSRouteContractError
from .snap import SnapNotFoundError, SnapContractError, SnapValidationError
from .state_od import StateODContractError, StateODValidationError
from .viago_geometry import ViagoGeometryUnavailable, make_viago_route


def _local_routing_connection():
    """Fail closed before any graph access; never fall back to default DB."""
    if not settings.DEBUG:
        return None
    if "routing" not in connections.databases:
        return None
    db = connections.databases["routing"]
    opts = db.get("OPTIONS") or {}
    required = (
        db.get("ENGINE") == "django.db.backends.postgresql"
        and db.get("HOST") == "127.0.0.1"
        and str(db.get("PORT")) == "55433"
        and db.get("NAME") == "adresse_gn_real_lab"
        and db.get("USER") == "postgres"
        and "default_transaction_read_only=on" in str(opts.get("options", ""))
        and opts.get("sslmode") == "disable"
    )
    return connections["routing"] if required else None


class ViagoRequestSerializer(serializers.Serializer):
    start_latitude = serializers.FloatField(min_value=-90, max_value=90)
    start_longitude = serializers.FloatField(min_value=-180, max_value=180)
    end_latitude = serializers.FloatField(min_value=-90, max_value=90)
    end_longitude = serializers.FloatField(min_value=-180, max_value=180)
    profile = serializers.ChoiceField(choices=("car", "motorcycle", "foot"))
    alternatives = serializers.IntegerField(required=False, default=0, min_value=0, max_value=2)


class ViagoLocalRouteView(APIView):
    """Loopback-only public TEST endpoint; never expose as production gateway.

    Isolation is checked before any DB access. Other API views retain auth.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        # Accept anonymous usage only from the explicitly isolated local lab.
        # No untrusted Origin or public network clients may invoke the graph.
        import os
        from django.conf import settings
        if (
            not settings.DEBUG
            or os.environ.get("DJANGO_SETTINGS_MODULE") != "config.settings_viago_local"
            or os.environ.get("VIAGO_LOCAL_ROUTING_ENABLED") != "1"
            or request.META.get("REMOTE_ADDR") not in {"127.0.0.1", "::1"}
            or request.get_host() not in {"127.0.0.1:8001", "localhost:8001"}
            or request.META.get("HTTP_ORIGIN", "") not in {
                "", "http://localhost:3000", "http://127.0.0.1:3000"
            }
        ):
            return Response(
                {"status": "local_access_denied", "geometry": None},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = ViagoRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        routing_db = _local_routing_connection()
        if routing_db is None:
            return Response({"status": "routing_not_isolated", "geometry": None},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        try:
            params = {k: v for k, v in serializer.validated_data.items() if k != "alternatives"}
            result = make_viago_route(**params, db_connection=routing_db)
        except (GPSRouteValidationError, SnapValidationError,
                StateODValidationError, ValueError):
            return Response({"status": "invalid_input", "geometry": None},
                            status=status.HTTP_400_BAD_REQUEST)
        except (DatabaseError, ViagoGeometryUnavailable, GPSRouteContractError,
                SnapContractError, SnapNotFoundError, StateODContractError):
            return Response({"status": "routing_unavailable", "geometry": None,
                             "message": "Le graphe local ne fournit pas de tracé fiable."},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(result, status=status.HTTP_200_OK)
