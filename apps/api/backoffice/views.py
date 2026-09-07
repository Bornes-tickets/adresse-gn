from drf_spectacular.utils import (
    extend_schema,
)
from rest_framework import status
from rest_framework.permissions import (
    IsAuthenticated,
)
from rest_framework.response import Response
from rest_framework.views import APIView

from .accounts import (
    reactivate_account,
)
from .claims import (
    VALID_CLAIM_STATUSES,
    decide_claim,
    list_claims,
)
from .permissions import (
    IsClaimBackofficeUser,
)
from .serializers import (
    AccountReactivateSerializer,
    ClaimDecisionSerializer,
)


class BackofficeMeView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsClaimBackofficeUser,
    ]

    @extend_schema(
        tags=["Back-office"],
        description=(
            "Retourne l'identité métier de "
            "l'utilisateur du back-office."
        ),
    )
    def get(self, request):
        identity = getattr(
            request,
            "backoffice_identity",
            None,
        )

        return Response(
            {
                "authenticated": True,
                "user": identity,
            },
            status=status.HTTP_200_OK,
        )


class ClaimListView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsClaimBackofficeUser,
    ]

    @extend_schema(
        tags=["Back-office"],
        description=(
            "Liste les revendications "
            "d'adresses accessibles au support."
        ),
    )
    def get(self, request):
        status_filter = (
            request.query_params.get(
                "status"
            )
        )

        if status_filter in {
            "",
            "all",
        }:
            status_filter = None

        if (
            status_filter is not None
            and status_filter
            not in VALID_CLAIM_STATUSES
        ):
            return Response(
                {
                    "ok": False,
                    "status": (
                        "invalid_filter"
                    ),
                    "message": (
                        "Statut de "
                        "revendication invalide."
                    ),
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        try:
            result = list_claims(
                status_filter=status_filter,
            )

        except Exception:
            return Response(
                {
                    "ok": False,
                    "status": "error",
                    "message": (
                        "Impossible de charger "
                        "les revendications."
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


class ClaimDecisionView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsClaimBackofficeUser,
    ]

    @extend_schema(
        tags=["Back-office"],
        request=ClaimDecisionSerializer,
        description=(
            "Approuve ou rejette une "
            "revendication en attente."
        ),
    )
    def post(
        self,
        request,
        claim_id,
    ):
        serializer = (
            ClaimDecisionSerializer(
                data=request.data
            )
        )

        serializer.is_valid(
            raise_exception=True
        )

        identity = getattr(
            request,
            "backoffice_identity",
            None,
        )

        actor_id = (
            identity.get("user_id")
            if identity
            else None
        )

        if not actor_id:
            return Response(
                {
                    "ok": False,
                    "status": (
                        "unauthenticated"
                    ),
                    "message": (
                        "Authentification requise."
                    ),
                },
                status=(
                    status.HTTP_401_UNAUTHORIZED
                ),
            )

        try:
            result = decide_claim(
                claim_id=str(
                    claim_id
                ),
                decision=(
                    serializer
                    .validated_data[
                        "decision"
                    ]
                ),
                note=(
                    serializer
                    .validated_data
                    .get("note")
                ),
                actor_id=actor_id,
            )

        except Exception:
            return Response(
                {
                    "ok": False,
                    "status": "error",
                    "message": (
                        "La décision n'a pas "
                        "pu être enregistrée."
                    ),
                },
                status=(
                    status.HTTP_500_INTERNAL_SERVER_ERROR
                ),
            )

        if result["status"] == "not_found":
            return Response(
                result,
                status=(
                    status.HTTP_404_NOT_FOUND
                ),
            )

        if result["status"] in {
            "already_processed",
            "address_missing",
            "already_owned",
        }:
            return Response(
                result,
                status=(
                    status.HTTP_409_CONFLICT
                ),
            )

        if result["status"] == (
            "invalid_decision"
        ):
            return Response(
                result,
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        return Response(
            result,
            status=status.HTTP_200_OK,
        )

class AccountReactivateView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsClaimBackofficeUser,
    ]

    @extend_schema(
        tags=["Back-office"],
        request=AccountReactivateSerializer,
        description=(
            "Réactive un compte utilisateur désactivé "
            "après vérification d'identité."
        ),
    )
    def post(self, request, user_id):
        serializer = AccountReactivateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        identity = getattr(request, "backoffice_identity", None)
        actor_id = identity.get("user_id") if identity else None

        if not actor_id:
            return Response(
                {
                    "ok": False,
                    "status": "unauthenticated",
                    "message": "Authentification back-office requise.",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            result = reactivate_account(
                user_id=str(user_id),
                actor_id=actor_id,
                verification_method=serializer.validated_data["verification_method"],
                verification_note=serializer.validated_data["verification_note"],
            )
        except Exception:
            return Response(
                {
                    "ok": False,
                    "status": "error",
                    "message": "La réactivation du compte n'a pas pu être enregistrée.",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if result["status"] == "not_found":
            return Response(result, status=status.HTTP_404_NOT_FOUND)

        if result["status"] == "forbidden_target":
            return Response(result, status=status.HTTP_403_FORBIDDEN)

        if result["status"] in {"not_deactivated", "conflict"}:
            return Response(result, status=status.HTTP_409_CONFLICT)

        if result["status"] in {
            "invalid_verification_method",
            "missing_verification_note",
        }:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

        return Response(result, status=status.HTTP_200_OK)
