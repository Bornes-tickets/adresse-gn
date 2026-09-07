from drf_spectacular.utils import (
    extend_schema,
)
from rest_framework import status
from rest_framework.authentication import (
    get_authorization_header,
)
from rest_framework.permissions import (
    IsAuthenticated,
)
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    OwnerAccountDeactivateSerializer,
    OwnerBeaconUpdateSerializer,
    OwnerFavoriteCreateSerializer,
    OwnerFavoriteUpdateSerializer,
    OwnerMovingReportSerializer,
    OwnerProfileUpdateSerializer,
)
from .services import (
    OwnerAccountAlreadyDeactivatedError,
    OwnerAccountDeactivationForbiddenError,
    OwnerAccountSubscriptionActiveError,
    OwnerAddressAccessError,
    OwnerFavoriteConflictError,
    OwnerFavoriteInputError,
    OwnerFavoriteNotFoundError,
    OwnerProfileNotFoundError,
    OwnerSessionRevocationError,
    create_owner_favorite,
    create_owner_moving_report,
    deactivate_owner_account,
    delete_owner_favorite,
    get_owner_dashboard,
    get_owner_profile,
    list_owner_beacons,
    list_owner_claims,
    list_owner_favorites,
    list_owner_orders,
    list_owner_reports,
    revoke_owner_supabase_sessions,
    suspend_owner_beacon,
    update_owner_beacon,
    update_owner_favorite,
    update_owner_profile,
)




class OwnerDashboardView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    @extend_schema(
        tags=["Owner portal"],
        description=(
            "Retourne le tableau de bord "
            "du propriétaire connecté."
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
            result = get_owner_dashboard(
                user_id=user_id,
            )

        except Exception:
            return Response(
                {
                    "detail": (
                        "Impossible de charger "
                        "le tableau de bord."
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


class OwnerFavoriteListCreateView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    @extend_schema(
        tags=["Owner portal"],
        description=(
            "Liste les favoris de "
            "l'utilisateur connecté."
        ),
    )
    def get(self, request):
        user_id = getattr(
            request.user,
            "id",
            None,
        )

        items = list_owner_favorites(
            user_id=user_id,
        )

        return Response(
            {
                "items": items,
            },
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Owner portal"],
        request=OwnerFavoriteCreateSerializer,
        description=(
            "Ajoute une Adresse GN "
            "aux favoris du compte connecté."
        ),
    )
    def post(self, request):
        serializer = (
            OwnerFavoriteCreateSerializer(
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
            result = create_owner_favorite(
                user_id=user_id,
                raw_number=(
                    serializer
                    .validated_data[
                        "number"
                    ]
                ),
                alias=(
                    serializer
                    .validated_data
                    .get("alias")
                ),
            )

        except OwnerFavoriteInputError as exc:
            return Response(
                {
                    "detail": str(exc),
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        except OwnerFavoriteNotFoundError as exc:
            return Response(
                {
                    "detail": str(exc),
                },
                status=(
                    status.HTTP_404_NOT_FOUND
                ),
            )

        except OwnerFavoriteConflictError as exc:
            return Response(
                {
                    "detail": str(exc),
                },
                status=(
                    status.HTTP_409_CONFLICT
                ),
            )

        return Response(
            result,
            status=status.HTTP_201_CREATED,
        )


class OwnerFavoriteDetailView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    @extend_schema(
        tags=["Owner portal"],
        request=OwnerFavoriteUpdateSerializer,
        description=(
            "Modifie l'alias d'un favori "
            "appartenant au compte connecté."
        ),
    )
    def patch(
        self,
        request,
        favorite_id,
    ):
        serializer = (
            OwnerFavoriteUpdateSerializer(
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
            result = update_owner_favorite(
                user_id=user_id,
                favorite_id=str(
                    favorite_id
                ),
                alias=(
                    serializer
                    .validated_data
                    .get("alias")
                ),
            )

        except OwnerFavoriteNotFoundError as exc:
            return Response(
                {
                    "detail": str(exc),
                },
                status=(
                    status.HTTP_404_NOT_FOUND
                ),
            )

        return Response(
            result,
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Owner portal"],
        request=None,
        description=(
            "Retire un favori appartenant "
            "au compte connecté."
        ),
    )
    def delete(
        self,
        request,
        favorite_id,
    ):
        user_id = getattr(
            request.user,
            "id",
            None,
        )

        try:
            result = delete_owner_favorite(
                user_id=user_id,
                favorite_id=str(
                    favorite_id
                ),
            )

        except OwnerFavoriteNotFoundError as exc:
            return Response(
                {
                    "detail": str(exc),
                },
                status=(
                    status.HTTP_404_NOT_FOUND
                ),
            )

        return Response(
            result,
            status=status.HTTP_200_OK,
        )



class OwnerOrderListView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    @extend_schema(
        tags=["Owner portal"],
        description=(
            "Liste les commandes du "
            "compte connecté avec leurs "
            "sites, paiement et facture."
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
            items = list_owner_orders(
                user_id=user_id,
            )

        except Exception:
            return Response(
                {
                    "detail": (
                        "Impossible de charger "
                        "vos commandes."
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



class OwnerReportListView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    @extend_schema(
        tags=["Owner portal"],
        description=(
            "Liste les signalements du "
            "compte connecté, y compris "
            "les signalements de déménagement."
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
            items = list_owner_reports(
                user_id=user_id,
            )

        except Exception:
            return Response(
                {
                    "detail": (
                        "Impossible de charger "
                        "vos signalements."
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


class OwnerClaimListView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    @extend_schema(
        tags=["Owner portal"],
        description=(
            "Liste les réclamations "
            "d'adresse du compte connecté."
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
            items = list_owner_claims(
                user_id=user_id,
            )

        except Exception:
            return Response(
                {
                    "detail": (
                        "Impossible de charger "
                        "vos réclamations."
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



class OwnerProfileView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    @extend_schema(
        tags=["Owner portal"],
        description=(
            "Retourne le profil métier "
            "du compte connecté."
        ),
    )
    def get(self, request):
        user_id = getattr(
            request.user,
            "id",
            None,
        )

        try:
            profile = get_owner_profile(
                user_id=user_id,
            )

        except OwnerProfileNotFoundError as exc:
            return Response(
                {
                    "detail": str(exc),
                },
                status=(
                    status.HTTP_404_NOT_FOUND
                ),
            )

        return Response(
            profile,
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Owner portal"],
        request=OwnerProfileUpdateSerializer,
        description=(
            "Modifie uniquement le nom "
            "et le téléphone métier "
            "du compte connecté."
        ),
    )
    def patch(self, request):
        serializer = (
            OwnerProfileUpdateSerializer(
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
            result = update_owner_profile(
                user_id=user_id,
                changes=dict(
                    serializer.validated_data
                ),
            )

        except OwnerProfileNotFoundError as exc:
            return Response(
                {
                    "detail": str(exc),
                },
                status=(
                    status.HTTP_404_NOT_FOUND
                ),
            )

        return Response(
            result,
            status=status.HTTP_200_OK,
        )


class OwnerAccountDeactivateView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    @extend_schema(
        tags=["Owner portal"],
        request=OwnerAccountDeactivateSerializer,
        description=(
            "Désactive le compte utilisateur connecté "
            "sans supprimer ses données métier."
        ),
    )
    def post(self, request):
        serializer = OwnerAccountDeactivateSerializer(
            data=request.data
        )
        serializer.is_valid(
            raise_exception=True
        )

        user_id = getattr(
            request.user,
            "id",
            None,
        )

        if not user_id:
            return Response(
                {
                    "detail": "Authentification requise.",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        authorization = get_authorization_header(
            request
        ).split()

        if (
            len(authorization) != 2
            or authorization[0].lower() != b"bearer"
        ):
            return Response(
                {
                    "detail": "Jeton de session introuvable.",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            access_token = authorization[1].decode(
                "utf-8"
            )
        except UnicodeError:
            return Response(
                {
                    "detail": "Jeton de session invalide.",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            result = deactivate_owner_account(
                user_id=user_id,
            )
        except OwnerProfileNotFoundError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_404_NOT_FOUND,
            )
        except OwnerAccountDeactivationForbiddenError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_403_FORBIDDEN,
            )
        except OwnerAccountSubscriptionActiveError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_409_CONFLICT,
            )
        except OwnerAccountAlreadyDeactivatedError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_409_CONFLICT,
            )

        sessions_revoked = True

        try:
            revoke_owner_supabase_sessions(
                access_token=access_token,
            )
        except OwnerSessionRevocationError:
            sessions_revoked = False

        return Response(
            {
                **result,
                "sessions_revoked": sessions_revoked,
                "message": (
                    "Compte désactivé."
                    if sessions_revoked
                    else (
                        "Compte désactivé. La révocation distante "
                        "des sessions n'a pas pu être confirmée."
                    )
                ),
            },
            status=status.HTTP_200_OK,
        )
