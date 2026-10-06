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
    record_physical_installation,
)
from .physical_installation_workflow import (
    PhysicalWorkflowNotFoundError,
    PhysicalWorkflowStateError,
    assign_physical_installation,
    publish_physical_address,
    reassign_physical_installation,
    schedule_physical_installation,
    validate_physical_installation,
)
from .permissions import (
    IsClaimBackofficeUser,
    IsInstallationBackofficeUser,
)
from .serializers import (
    AccountReactivateSerializer,
    ClaimDecisionSerializer,
    InstallationUninstallSerializer,
    PhysicalInstallationAssignSerializer,
    PhysicalInstallationCompleteSerializer,
    PhysicalInstallationScheduleSerializer,
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



class PhysicalInstallationAssignView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsInstallationBackofficeUser,
    ]

    @extend_schema(
        tags=["Back-office"],
        request=PhysicalInstallationAssignSerializer,
        description=(
            "Affecte un agent actif a une installation physique en attente."
        ),
    )
    def post(self, request, pending_installation_id):
        serializer = PhysicalInstallationAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        identity = getattr(request, "backoffice_identity", None)
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
            result = assign_physical_installation(
                pending_installation_id=str(pending_installation_id),
                actor_id=str(actor_id),
                agent_id=str(serializer.validated_data["agent_id"]),
            )
        except PhysicalWorkflowNotFoundError as exc:
            return Response(
                {"ok": False, "status": "not_found", "message": str(exc)},
                status=status.HTTP_404_NOT_FOUND,
            )
        except PhysicalWorkflowStateError as exc:
            return Response(
                {"ok": False, "status": "conflict", "message": str(exc)},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(result, status=status.HTTP_200_OK)



class PhysicalInstallationReassignView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsInstallationBackofficeUser,
    ]

    @extend_schema(
        tags=["Back-office"],
        request=PhysicalInstallationAssignSerializer,
        description=(
            "Reaffecte une installation physique deja affectee "
            "ou planifiee a un autre agent actif. "
            "Le statut et la date planifiee sont preserves."
        ),
    )
    def post(self, request, pending_installation_id):
        serializer = PhysicalInstallationAssignSerializer(
            data=request.data
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
                    "message": "Authentification requise.",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            result = reassign_physical_installation(
                pending_installation_id=str(
                    pending_installation_id
                ),
                actor_id=str(actor_id),
                agent_id=str(
                    serializer.validated_data[
                        "agent_id"
                    ]
                ),
            )

        except PhysicalWorkflowNotFoundError as exc:
            return Response(
                {
                    "ok": False,
                    "status": "not_found",
                    "message": str(exc),
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        except PhysicalWorkflowStateError as exc:
            return Response(
                {
                    "ok": False,
                    "status": "conflict",
                    "message": str(exc),
                },
                status=status.HTTP_409_CONFLICT,
            )

        return Response(
            result,
            status=status.HTTP_200_OK,
        )


class PhysicalInstallationScheduleView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsInstallationBackofficeUser,
    ]

    @extend_schema(
        tags=["Back-office"],
        request=PhysicalInstallationScheduleSerializer,
        description=(
            "Planifie ou replanifie une installation physique affectee."
        ),
    )
    def post(self, request, pending_installation_id):
        serializer = PhysicalInstallationScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        identity = getattr(request, "backoffice_identity", None)
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
            result = schedule_physical_installation(
                pending_installation_id=str(pending_installation_id),
                actor_id=str(actor_id),
                scheduled_at=serializer.validated_data["scheduled_at"],
            )
        except PhysicalWorkflowNotFoundError as exc:
            return Response(
                {"ok": False, "status": "not_found", "message": str(exc)},
                status=status.HTTP_404_NOT_FOUND,
            )
        except PhysicalWorkflowStateError as exc:
            return Response(
                {"ok": False, "status": "conflict", "message": str(exc)},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(result, status=status.HTTP_200_OK)


class PhysicalAddressPublishView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsInstallationBackofficeUser,
    ]

    @extend_schema(
        tags=["Back-office"],
        request=None,
        description=(
            "Publie explicitement une adresse physique deja validee. "
            "La publication exige un workflow done, une adresse active et "
            "verified ainsi qu une balise active."
        ),
    )
    def post(self, request, pending_installation_id):
        identity = getattr(request, "backoffice_identity", None)
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
            result = publish_physical_address(
                pending_installation_id=str(pending_installation_id),
                actor_id=str(actor_id),
            )
        except PhysicalWorkflowNotFoundError as exc:
            return Response(
                {"ok": False, "status": "not_found", "message": str(exc)},
                status=status.HTTP_404_NOT_FOUND,
            )
        except PhysicalWorkflowStateError as exc:
            return Response(
                {"ok": False, "status": "conflict", "message": str(exc)},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(result, status=status.HTTP_200_OK)


class PhysicalInstallationValidateView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsInstallationBackofficeUser,
    ]

    @extend_schema(
        tags=["Back-office"],
        request=None,
        description=(
            "Valide une intervention terrain deja enregistree. "
            "La validation marque l installation comme validee, "
            "passe l adresse a verified et clot le workflow en done. "
            "Elle ne publie jamais automatiquement l adresse."
        ),
    )
    def post(self, request, pending_installation_id):
        identity = getattr(request, "backoffice_identity", None)
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
            result = validate_physical_installation(
                pending_installation_id=str(pending_installation_id),
                actor_id=str(actor_id),
            )
        except PhysicalWorkflowNotFoundError as exc:
            return Response(
                {"ok": False, "status": "not_found", "message": str(exc)},
                status=status.HTTP_404_NOT_FOUND,
            )
        except PhysicalWorkflowStateError as exc:
            return Response(
                {"ok": False, "status": "conflict", "message": str(exc)},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(result, status=status.HTTP_200_OK)


class PhysicalInstallationFieldCompleteView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsInstallationBackofficeUser,
    ]

    @extend_schema(
        tags=["Back-office"],
        request=PhysicalInstallationCompleteSerializer,
        description=(
            "Enregistre l intervention terrain V1, cree la balise, "
            "l adresse privee en attente de validation et l installation."
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
            result = record_physical_installation(
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
                        "L intervention terrain n a pas pu etre enregistree."
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
