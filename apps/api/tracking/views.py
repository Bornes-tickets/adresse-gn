from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import PublicTrackingOrderSerializer
from .services import fetch_public_order_by_token


class PublicTrackingOrderView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Tracking"],
        responses={200: PublicTrackingOrderSerializer},
        description=(
            "Retourne le suivi public minimal d'une demande Adresse GN via guest_token."
        ),
    )
    def get(self, request, token: str):
        order = fetch_public_order_by_token(token)
        if order is None:
            return Response(
                {
                    "detail": "Demande introuvable.",
                    "code": "TRACKING_NOT_FOUND",
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = PublicTrackingOrderSerializer(order)
        return Response(serializer.data, status=status.HTTP_200_OK)
