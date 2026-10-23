from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .global_resources import (
    RESOURCE_CONFIGS,
    assert_resource_access,
    list_resource_data,
)
from .permissions import IsBackofficeUser


class BackofficeResourceListView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsBackofficeUser,
    ]

    @extend_schema(
        tags=["Back-office"],
        description=(
            "Expose les contenus historiques "
            "du back-office via un contrat "
            "de lecture mutualisé."
        ),
    )
    def get(
        self,
        request,
        resource,
    ):
        if resource not in RESOURCE_CONFIGS:
            return Response(
                {
                    "detail":
                        "Ressource inconnue.",
                },
                status=(
                    status.HTTP_404_NOT_FOUND
                ),
            )

        assert_resource_access(
            request,
            resource,
        )

        try:
            page = int(
                request.query_params.get(
                    "page",
                    "1",
                )
            )

            page_size = int(
                request.query_params.get(
                    "page_size",
                    "25",
                )
            )
        except ValueError:
            return Response(
                {
                    "detail":
                        "Pagination invalide.",
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        return Response(
            list_resource_data(
                resource,
                q=(
                    request.query_params.get(
                        "q",
                        "",
                    )
                ),
                page=page,
                page_size=page_size,
            ),
            status=status.HTTP_200_OK,
        )