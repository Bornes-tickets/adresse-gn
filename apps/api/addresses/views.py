from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    AddressSearchSerializer,
    RouteLogSerializer,
)
from .services import (
    client_ip,
    get_address_detail,
    log_route_launch,
    search_address,
)


class AddressSearchView(APIView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(
        tags=["Addresses"],
        request=AddressSearchSerializer,
        description=(
            "Recherche une Adresse GN à partir "
            "de son numéro public."
        ),
    )
    def post(self, request):
        serializer = AddressSearchSerializer(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        try:
            result = search_address(
                raw_number=(
                    serializer.validated_data[
                        "number"
                    ]
                ),
                ip=client_ip(request),
            )
        except Exception:
            return Response(
                {
                    "status": "error",
                    "beacon_id": None,
                    "result": None,
                    "message": (
                        "Une erreur interne "
                        "est survenue."
                    ),
                },
                status=(
                    status.HTTP_500_INTERNAL_SERVER_ERROR
                ),
            )

        http_status = status.HTTP_200_OK

        if result["status"] == "invalid":
            http_status = (
                status.HTTP_400_BAD_REQUEST
            )

        elif result["status"] == "rate_limited":
            http_status = (
                status.HTTP_429_TOO_MANY_REQUESTS
            )

        return Response(
            result,
            status=http_status,
        )


class AddressDetailView(APIView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(
        tags=["Addresses"],
        description=(
            "Retourne la fiche publique "
            "d'une Adresse GN sans créer "
            "une nouvelle recherche."
        ),
    )
    def get(self, request, number):
        try:
            result = get_address_detail(
                raw_number=number,
            )
        except Exception:
            return Response(
                {
                    "status": "error",
                    "beacon_id": None,
                    "result": None,
                    "message": (
                        "Une erreur interne "
                        "est survenue."
                    ),
                },
                status=(
                    status.HTTP_500_INTERNAL_SERVER_ERROR
                ),
            )

        if result["status"] == "invalid":
            return Response(
                result,
                status=status.HTTP_400_BAD_REQUEST,
            )

        if result["status"] == "not_found":
            return Response(
                result,
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            result,
            status=status.HTTP_200_OK,
        )


class RouteLogView(APIView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(
        tags=["Addresses"],
        request=RouteLogSerializer,
        description=(
            "Journalise le lancement d'un itinéraire "
            "Google Maps ou Waze pour une Adresse GN."
        ),
    )
    def post(self, request, number):
        serializer = RouteLogSerializer(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        try:
            result = log_route_launch(
                raw_number=number,
                provider=(
                    serializer.validated_data[
                        "provider"
                    ]
                ),
            )
        except Exception:
            return Response(
                {
                    "ok": False,
                    "status": "error",
                    "message": (
                        "La journalisation de "
                        "l'itinéraire a échoué."
                    ),
                },
                status=(
                    status.HTTP_500_INTERNAL_SERVER_ERROR
                ),
            )

        if result["status"] == "invalid":
            return Response(
                result,
                status=status.HTTP_400_BAD_REQUEST,
            )

        if result["status"] == "not_found":
            return Response(
                result,
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            result,
            status=status.HTTP_201_CREATED,
        )
