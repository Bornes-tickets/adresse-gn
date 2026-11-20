"""VIAGO staging-only protected route endpoint.

This does not relax ViagoLocalRouteView's loopback/DEBUG protections.
The bearer token belongs ONLY in server-side configuration, never in APK or JS.
"""
from __future__ import annotations

import secrets

from django.conf import settings
from django.db import DatabaseError, connections, transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .gps_route import GPSRouteContractError, GPSRouteValidationError
from .snap import SnapContractError, SnapNotFoundError, SnapValidationError
from .state_od import StateODContractError, StateODValidationError
from .viago_geometry import ViagoGeometryUnavailable, make_viago_alternatives, make_viago_route
from .viago_views import ViagoRequestSerializer


class ViagoStagingRouteView(APIView):
    """Dedicated staging route, not a public anonymous navigation API."""

    authentication_classes = []
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "viago_staging_route"
    http_method_names = ["post", "options"]

    def post(self, request):
        authorization = request.headers.get("Authorization", "")
        expected = getattr(settings, "VIAGO_STAGING_BEARER_TOKEN", "")
        if (
            not authorization.startswith("Bearer ")
            or not expected
            or not secrets.compare_digest(authorization[7:], expected)
        ):
            # Do not log or echo bearer values, IPs, coordinates, or SQL.
            return Response({"detail": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = ViagoRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        alias = "viago_routing"
        try:
            # Atomic on the dedicated alias ensures all nested routing cursors
            # share one explicitly READ ONLY transaction and its search_path.
            with transaction.atomic(using=alias):
                with connections[alias].cursor() as cursor:
                    cursor.execute("SET TRANSACTION READ ONLY")
                    cursor.execute(
                        "SET LOCAL search_path TO extensions, public, maps_routing_stage"
                    )
                    cursor.execute("SET LOCAL statement_timeout TO 12000")
                    cursor.execute("SET LOCAL lock_timeout TO 3000")
                params = dict(serializer.validated_data)
                alternatives = int(params.pop("alternatives", 0) or 0)
                if alternatives > 0:
                    result = make_viago_alternatives(
                        count=alternatives, db_connection=connections[alias], **params)
                else:
                    result = make_viago_route(
                        **params, db_connection=connections[alias])
        except (GPSRouteValidationError, SnapValidationError, StateODValidationError, ValueError):
            return Response({"detail": "Invalid route request"}, status=status.HTTP_400_BAD_REQUEST)
        except (
            DatabaseError,
            ViagoGeometryUnavailable,
            GPSRouteContractError,
            SnapContractError,
            SnapNotFoundError,
            StateODContractError,
        ) as exc:
            # Cote serveur uniquement (console locale) : type et debut du message, jamais renvoyes au client.
            print("VIAGO_ROUTE_503 =", type(exc).__name__, str(exc)[:300], flush=True)
            # No internal errors, SQL, or credentials are exposed to callers.
            return Response({"detail": "Routing temporarily unavailable"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response(result, status=status.HTTP_200_OK)
