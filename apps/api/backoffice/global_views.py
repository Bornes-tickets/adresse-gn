from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .global_portal import (
    load_navigation,
    load_role_dashboard,
)
from .permissions import IsBackofficeUser


class BackofficeNavigationView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsBackofficeUser,
    ]

    @extend_schema(
        tags=["Back-office"],
        description=(
            "Retourne la navigation canonique "
            "de l'espace métier demandé."
        ),
    )
    def get(self, request):
        return Response(
            load_navigation(request),
            status=status.HTTP_200_OK,
        )


class BackofficeRoleDashboardView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsBackofficeUser,
    ]

    @extend_schema(
        tags=["Back-office"],
        description=(
            "Retourne le tableau de bord "
            "canonique Supervisor/Ops/Sales/Support."
        ),
    )
    def get(self, request):
        return Response(
            load_role_dashboard(request),
            status=status.HTTP_200_OK,
        )