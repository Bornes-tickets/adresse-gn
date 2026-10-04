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
    list_accounts,
    reactivate_account,
)
from .claims import (
    VALID_CLAIM_STATUSES,
    decide_claim,
    list_claims,
)
from .installations import (
    register_installation_uninstall,
)
from .physical_installations import (
    PhysicalInstallationNotFoundError,
    PhysicalInstallationStateError,
    complete_physical_installation,
)
from .permissions import (
    IsClaimBackofficeUser,
    IsInstallationBackofficeUser,
)
from .serializers import (
    AccountReactivateSerializer,
    ClaimDecisionSerializer,
    InstallationUninstallSerializer,
    PhysicalInstallationCompleteSerializer,
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

class AccountListView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsClaimBackofficeUser,
    ]

    @extend_schema(
        tags=["Back-office"],
        description=(
            "Liste les comptes utilisateur "
            "pour le support Adresse GN."
        ),
    )
    def get(
        self,
        request,
    ):
        status_filter = (
            request.query_params.get(
                "status",
                "deactivated",
            )
        )
        query = (
            request.query_params.get(
                "q",
                "",
            )
        )

        try:
            result = list_accounts(
                status_filter=status_filter,
                query=query,
            )
        except ValueError as exc:
            return Response(
                {
                    "ok": False,
                    "status": "invalid_filter",
                    "message": str(exc),
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )
        except Exception:
            return Response(
                {
                    "ok": False,
                    "status": "error",
                    "message": (
                        "Impossible de charger "
                        "les comptes utilisateur."
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



class PhysicalInstallationCompleteView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsInstallationBackofficeUser,
    ]

    @extend_schema(
        tags=["Back-office"],
        request=PhysicalInstallationCompleteSerializer,
        description=(
            "Finalise une installation physique V1 et cree "
            "la balise, l'adresse canonique et l'installation terrain."
        ),
    )
    def post(self, request, pending_installation_id):
        serializer = PhysicalInstallationCompleteSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        identity = getattr(
            request,
            "backoffice_identity",
            None,
        )
        actor_id = identity.get("user_id") if identity else None

        if not actor_id:
            return Response(
                {
                    "ok": False,
                    "status": "unauthenticated",
                    "message": "Authentification requise.",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            result = complete_physical_installation(
                pending_installation_id=str(pending_installation_id),
                actor_id=str(actor_id),
                agent_id=str(serializer.validated_data["agent_id"]),
                gps_lat=serializer.validated_data["gps_lat"],
                gps_lng=serializer.validated_data["gps_lng"],
                accuracy_m=serializer.validated_data.get("accuracy_m"),
                photo_url=serializer.validated_data.get("photo_url"),
            )
        except PhysicalInstallationNotFoundError as exc:
            return Response(
                {
                    "ok": False,
                    "status": "not_found",
                    "message": str(exc),
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        except PhysicalInstallationStateError as exc:
            return Response(
                {
                    "ok": False,
                    "status": "conflict",
                    "message": str(exc),
                },
                status=status.HTTP_409_CONFLICT,
            )
        except Exception:
            return Response(
                {
                    "ok": False,
                    "status": "error",
                    "message": (
                        "L'installation physique n'a pas pu etre finalisee."
                    ),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            result,
            status=status.HTTP_200_OK,
        )


class InstallationUninstallView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsInstallationBackofficeUser,
    ]

    @extend_schema(
        tags=["Back-office"],
        request=InstallationUninstallSerializer,
        description=(
            "Enregistre le retrait physique d'une "
            "ancienne installation Adresse GN."
        ),
    )
    def post(
        self,
        request,
        installation_id,
    ):
        serializer = (
            InstallationUninstallSerializer(
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
                    "status": "unauthenticated",
                    "message": (
                        "Authentification requise."
                    ),
                },
                status=(
                    status.HTTP_401_UNAUTHORIZED
                ),
            )

        try:
            result = (
                register_installation_uninstall(
                    installation_id=str(
                        installation_id
                    ),
                    actor_id=actor_id,
                    agent_id=str(
                        serializer
                        .validated_data[
                            "agent_id"
                        ]
                    ),
                    reason=(
                        serializer
                        .validated_data[
                            "reason"
                        ]
                    ),
                    photo_url=(
                        serializer
                        .validated_data
                        .get(
                            "photo_url"
                        )
                    ),
                )
            )

        except Exception:
            return Response(
                {
                    "ok": False,
                    "status": "error",
                    "message": (
                        "Le retrait de l'installation "
                        "n'a pas pu être enregistré."
                    ),
                },
                status=(
                    status
                    .HTTP_500_INTERNAL_SERVER_ERROR
                ),
            )

        if result["status"] in {
            "not_found",
            "agent_not_found",
        }:
            return Response(
                result,
                status=(
                    status.HTTP_404_NOT_FOUND
                ),
            )

        if result["status"] in {
            "already_uninstalled",
            "invalid_numbering_version",
            "invalid_beacon_state",
            "agent_inactive",
        }:
            return Response(
                result,
                status=(
                    status.HTTP_409_CONFLICT
                ),
            )

        if result["status"] == (
            "invalid_reason"
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
