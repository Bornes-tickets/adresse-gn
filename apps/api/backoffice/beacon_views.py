from rest_framework import (
    status,
)
from rest_framework.permissions import (
    IsAuthenticated,
)
from rest_framework.response import (
    Response,
)
from rest_framework.views import (
    APIView,
)

from .beacons import (
    BeaconBackofficeNotFound,
    BeaconBackofficeValidationError,
    get_beacon_detail,
    list_beacons,
)
from .permissions import (
    IsBackofficeUser,
)


BEACON_BACKOFFICE_ROLES = {
    "supervisor",
    "admin",
    "super_admin",
}


class IsBeaconBackofficeUser(
    IsBackofficeUser
):
    message = (
        "Accès refusé : gestion des balises "
        "réservée aux superviseurs "
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
            in BEACON_BACKOFFICE_ROLES
        )


class BeaconListView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsBeaconBackofficeUser,
    ]

    def get(
        self,
        request,
    ):
        try:
            statuses = (
                request.query_params
                .get("statuses")
            )

            payload = list_beacons(
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
                statuses=statuses,
                lot_id=(
                    request.query_params
                    .get("lot_id")
                ),
                date_from=(
                    request.query_params
                    .get("from")
                ),
                date_to=(
                    request.query_params
                    .get("to")
                ),
                query=(
                    request.query_params
                    .get("q")
                ),
            )

        except (
            BeaconBackofficeValidationError
        ) as exc:
            return Response(
                {
                    "detail": str(
                        exc
                    ),
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        return Response(
            payload,
            status=status.HTTP_200_OK,
        )


class BeaconDetailView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsBeaconBackofficeUser,
    ]

    def get(
        self,
        request,
        beacon_id,
    ):
        try:
            payload = (
                get_beacon_detail(
                    beacon_id
                )
            )

        except (
            BeaconBackofficeNotFound
        ) as exc:
            return Response(
                {
                    "detail": str(
                        exc
                    ),
                },
                status=(
                    status.HTTP_404_NOT_FOUND
                ),
            )

        except (
            BeaconBackofficeValidationError
        ) as exc:
            return Response(
                {
                    "detail": str(
                        exc
                    ),
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        return Response(
            payload,
            status=status.HTTP_200_OK,
        )