from drf_spectacular.utils import (
    extend_schema,
)
from rest_framework import status
from rest_framework.permissions import (
    IsAuthenticated,
)
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    OwnerBeaconUpdateSerializer,
    OwnerMovingReportSerializer,
)
from .services import (
    OwnerAddressAccessError,
    create_owner_moving_report,
    list_owner_beacons,
    suspend_owner_beacon,
    update_owner_beacon,
)


class OwnerBeaconListView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    @extend_schema(
        tags=["Owner portal"],
        description=(
            "Liste les adresses dont "
            "l'utilisateur connecté est propriétaire."
        ),
    )
    def get(self, request):
        user_id = getattr(
            request.user,
            "id",
            None,
        )

        if not user_id:
            return Response(
                {
                    "detail": (
                        "Authentification requise."
                    ),
                },
                status=(
                    status.HTTP_401_UNAUTHORIZED
                ),
            )

        try:
            items = list_owner_beacons(
                user_id=user_id,
            )

        except Exception:
            return Response(
                {
                    "detail": (
                        "Impossible de charger "
                        "vos balises."
                    ),
                },
                status=(
                    status.HTTP_500_INTERNAL_SERVER_ERROR
                ),
            )

        return Response(
            {
                "items": items,
            },
            status=status.HTTP_200_OK,
        )


class OwnerBeaconDetailView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    @extend_schema(
        tags=["Owner portal"],
        request=OwnerBeaconUpdateSerializer,
        description=(
            "Modifie une adresse appartenant "
            "à l'utilisateur connecté."
        ),
    )
    def patch(
        self,
        request,
        address_id,
    ):
        serializer = (
            OwnerBeaconUpdateSerializer(
                data=request.data
            )
        )

        serializer.is_valid(
            raise_exception=True
        )

        user_id = getattr(
            request.user,
            "id",
            None,
        )

        try:
            result = update_owner_beacon(
                user_id=user_id,
                address_id=str(
                    address_id
                ),
                name=(
                    serializer
                    .validated_data
                    .get("name")
                ),
                category=(
                    serializer
                    .validated_data[
                        "category"
                    ]
                ),
                visibility=(
                    serializer
                    .validated_data[
                        "visibility"
                    ]
                ),
                access_point_note=(
                    serializer
                    .validated_data
                    .get(
                        "access_point_note"
                    )
                ),
            )

        except OwnerAddressAccessError as exc:
            return Response(
                {
                    "detail": str(exc),
                },
                status=(
                    status.HTTP_403_FORBIDDEN
                ),
            )

        except Exception:
            return Response(
                {
                    "detail": (
                        "La balise n'a pas "
                        "pu être mise à jour."
                    ),
                },
                status=(
                    status.HTTP_500_INTERNAL_SERVER_ERROR
                ),
            )

        return Response(
            result,
            status=status.HTTP_200_OK,
        )


class OwnerBeaconSuspendView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    @extend_schema(
        tags=["Owner portal"],
        request=None,
        description=(
            "Suspend une adresse appartenant "
            "à l'utilisateur connecté."
        ),
    )
    def post(
        self,
        request,
        address_id,
    ):
        user_id = getattr(
            request.user,
            "id",
            None,
        )

        try:
            result = suspend_owner_beacon(
                user_id=user_id,
                address_id=str(
                    address_id
                ),
            )

        except OwnerAddressAccessError as exc:
            return Response(
                {
                    "detail": str(exc),
                },
                status=(
                    status.HTTP_403_FORBIDDEN
                ),
            )

        except Exception:
            return Response(
                {
                    "detail": (
                        "La balise n'a pas "
                        "pu être suspendue."
                    ),
                },
                status=(
                    status.HTTP_500_INTERNAL_SERVER_ERROR
                ),
            )

        return Response(
            result,
            status=status.HTTP_200_OK,
        )


class OwnerMovingReportView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    @extend_schema(
        tags=["Owner portal"],
        request=OwnerMovingReportSerializer,
        description=(
            "Signale le déménagement d'une "
            "adresse appartenant à "
            "l'utilisateur connecté."
        ),
    )
    def post(
        self,
        request,
        address_id,
    ):
        serializer = (
            OwnerMovingReportSerializer(
                data=request.data
            )
        )

        serializer.is_valid(
            raise_exception=True
        )

        user_id = getattr(
            request.user,
            "id",
            None,
        )

        try:
            result = (
                create_owner_moving_report(
                    user_id=user_id,
                    address_id=str(
                        address_id
                    ),
                    description=(
                        serializer
                        .validated_data
                        .get("description")
                    ),
                )
            )

        except OwnerAddressAccessError as exc:
            return Response(
                {
                    "detail": str(exc),
                },
                status=(
                    status.HTTP_403_FORBIDDEN
                ),
            )

        except Exception:
            return Response(
                {
                    "detail": (
                        "Le signalement n'a pas "
                        "pu être enregistré."
                    ),
                },
                status=(
                    status.HTTP_500_INTERNAL_SERVER_ERROR
                ),
            )

        return Response(
            result,
            status=(
                status.HTTP_201_CREATED
            ),
        )