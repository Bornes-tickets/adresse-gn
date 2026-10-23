from rest_framework import status
from rest_framework.permissions import (
    IsAuthenticated,
)
from rest_framework.response import Response
from rest_framework.views import APIView

from .addresses import (
    AddressBackofficeNotFound,
    AddressBackofficeValidationError,
    get_address_detail,
    list_addresses,
)
from .permissions import IsBackofficeUser


ADDRESS_BACKOFFICE_ROLES = {
    "supervisor",
    "admin",
    "super_admin",
}


class IsAddressBackofficeUser(
    IsBackofficeUser
):
    message = (
        "Accès refusé : consultation des "
        "adresses réservée aux superviseurs "
        "et administrateurs Adresse GN."
    )

    def has_permission(
        self,
        request,
        view,
    ):
        if not super().has_permission(
            request,
            view,
        ):
            return False

        identity = getattr(
            request,
            "backoffice_identity",
            None,
        )

        if not identity:
            return False

        return (
            identity.get("role")
            in ADDRESS_BACKOFFICE_ROLES
        )


class AddressListView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsAddressBackofficeUser,
    ]

    def get(
        self,
        request,
    ):
        try:
            payload = list_addresses(
                page=(
                    request.query_params
                    .get(
                        "page",
                        1,
                    )
                ),

                page_size=(
                    request.query_params
                    .get(
                        "page_size",
                        20,
                    )
                ),

                visibility=(
                    request.query_params
                    .get(
                        "visibility"
                    )
                ),

                category=(
                    request.query_params
                    .get(
                        "category"
                    )
                ),

                verification=(
                    request.query_params
                    .get(
                        "verification"
                    )
                ),

                commune_id=(
                    request.query_params
                    .get(
                        "commune_id"
                    )
                ),

                district_id=(
                    request.query_params
                    .get(
                        "district_id"
                    )
                ),

                sector_id=(
                    request.query_params
                    .get(
                        "sector_id"
                    )
                ),

                status=(
                    request.query_params
                    .get(
                        "status"
                    )
                ),

                date_from=(
                    request.query_params
                    .get(
                        "from"
                    )
                ),

                date_to=(
                    request.query_params
                    .get(
                        "to"
                    )
                ),

                query=(
                    request.query_params
                    .get(
                        "q"
                    )
                ),
            )

        except (
            AddressBackofficeValidationError
        ) as exc:
            return Response(
                {
                    "detail": str(exc),
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        return Response(
            payload,
            status=status.HTTP_200_OK,
        )


class AddressDetailView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsAddressBackofficeUser,
    ]

    def get(
        self,
        request,
        address_id,
    ):
        try:
            payload = get_address_detail(
                address_id
            )

        except (
            AddressBackofficeNotFound
        ) as exc:
            return Response(
                {
                    "detail": str(exc),
                },
                status=(
                    status.HTTP_404_NOT_FOUND
                ),
            )

        except (
            AddressBackofficeValidationError
        ) as exc:
            return Response(
                {
                    "detail": str(exc),
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        return Response(
            payload,
            status=status.HTTP_200_OK,
        )