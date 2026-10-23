from rest_framework import status
from rest_framework.permissions import (
    AllowAny,
    IsAuthenticated,
)
from rest_framework.response import Response
from rest_framework.views import APIView

from agent_installations.services import (
    AgentCompletionConflictError,
    AgentCompletionContractError,
    AgentCompletionNotFoundError,
    AgentCompletionStateError,
    AgentCompletionStorageError,
    complete_agent_installation,
)


from .permissions import (
    IsActiveFieldAgent,
)
from .services import (
    AgentAuthServiceError,
    AgentInvalidCredentialsError,
    authenticate_agent_badge,
    list_agent_history,
    list_agent_tasks,
)


from .serializers import (
    AgentTaskCompleteSerializer,
)


class AgentBadgeLoginView(APIView):
    authentication_classes = []
    permission_classes = [
        AllowAny,
    ]

    def post(
        self,
        request,
    ):
        badge_number = str(
            request.data.get(
                "badge_number"
            ) or ""
        ).strip()

        password = str(
            request.data.get(
                "password"
            ) or ""
        )

        if (
            not badge_number
            or not password
        ):
            return Response(
                {
                    "detail": (
                        "Num?ro de badge ou "
                        "mot de passe invalide."
                    ),
                    "code": (
                        "AGENT_INVALID_CREDENTIALS"
                    ),
                },
                status=(
                    status.HTTP_401_UNAUTHORIZED
                ),
            )

        try:
            session = (
                authenticate_agent_badge(
                    badge_number=badge_number,
                    password=password,
                )
            )

        except AgentInvalidCredentialsError:
            return Response(
                {
                    "detail": (
                        "Num?ro de badge ou "
                        "mot de passe invalide."
                    ),
                    "code": (
                        "AGENT_INVALID_CREDENTIALS"
                    ),
                },
                status=(
                    status.HTTP_401_UNAUTHORIZED
                ),
            )

        except AgentAuthServiceError:
            return Response(
                {
                    "detail": (
                        "Le service de connexion "
                        "est temporairement indisponible."
                    ),
                    "code": (
                        "AGENT_AUTH_SERVICE_ERROR"
                    ),
                },
                status=(
                    status.HTTP_503_SERVICE_UNAVAILABLE
                ),
            )

        return Response(
            {
                "authenticated": True,
                "session": session,
            },
            status=status.HTTP_200_OK,
        )


class AgentMeView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsActiveFieldAgent,
    ]

    def get(
        self,
        request,
    ):
        identity = getattr(
            request,
            "agent_identity",
            None,
        )

        if not identity:
            return Response(
                {
                    "detail": (
                        "Authentification agent requise."
                    ),
                    "code": "AGENT_AUTH_REQUIRED",
                },
                status=(
                    status.HTTP_401_UNAUTHORIZED
                ),
            )

        return Response(
            {
                "authenticated": True,
                "agent": identity,
            },
            status=status.HTTP_200_OK,
        )


class AgentTaskListView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsActiveFieldAgent,
    ]

    def get(
        self,
        request,
    ):
        identity = getattr(
            request,
            "agent_identity",
            None,
        )

        if not identity:
            return Response(
                {
                    "detail": (
                        "Authentification agent requise."
                    ),
                    "code": "AGENT_AUTH_REQUIRED",
                },
                status=(
                    status.HTTP_401_UNAUTHORIZED
                ),
            )

        try:
            items = list_agent_tasks(
                agent_id=identity["user_id"],
            )
        except Exception:
            return Response(
                {
                    "detail": (
                        "Impossible de charger "
                        "les tâches terrain."
                    ),
                    "code": "AGENT_TASKS_LOAD_FAILED",
                },
                status=(
                    status.HTTP_500_INTERNAL_SERVER_ERROR
                ),
            )

        return Response(
            {
                "items": items,
                "count": len(items),
            },
            status=status.HTTP_200_OK,
        )

class AgentHistoryListView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsActiveFieldAgent,
    ]

    def get(
        self,
        request,
    ):
        identity = getattr(
            request,
            "agent_identity",
            None,
        )

        if not identity:
            return Response(
                {
                    "detail": "Authentification agent requise.",
                    "code": "AGENT_AUTH_REQUIRED",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            items = list_agent_history(
                agent_id=identity["user_id"],
            )
        except Exception:
            return Response(
                {
                    "detail": "Impossible de charger l historique des poses.",
                    "code": "AGENT_HISTORY_LOAD_FAILED",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "items": items,
                "count": len(items),
            },
            status=status.HTTP_200_OK,
        )


class AgentTaskCompleteView(APIView):
    """
    Authenticated Agent physical-completion endpoint.

    Agent identity always comes from request.agent_identity.
    No agent_id, beacon_id, order_id or sequence_no authority
    is accepted from the client payload.
    """

    permission_classes = [
        IsAuthenticated,
        IsActiveFieldAgent,
    ]

    def post(
        self,
        request,
        pending_installation_id,
    ):
        identity = getattr(
            request,
            "agent_identity",
            None,
        )

        agent_id = (
            identity.get(
                "user_id"
            )
            if identity
            else None
        )

        if not agent_id:
            return Response(
                {
                    "detail": (
                        "Authentification agent requise."
                    ),
                    "code": "AGENT_AUTH_REQUIRED",
                },
                status=(
                    status.HTTP_401_UNAUTHORIZED
                ),
            )

        serializer = (
            AgentTaskCompleteSerializer(
                data=request.data
            )
        )

        serializer.is_valid(
            raise_exception=True
        )

        try:
            result = (
                complete_agent_installation(
                    pending_installation_id=(
                        str(
                            pending_installation_id
                        )
                    ),
                    agent_id=str(
                        agent_id
                    ),
                    payload=(
                        serializer.validated_data
                    ),
                )
            )

        except AgentCompletionNotFoundError as exc:
            return Response(
                {
                    "detail": str(
                        exc
                    ),
                    "code": exc.code,
                },
                status=(
                    status.HTTP_404_NOT_FOUND
                ),
            )

        except AgentCompletionContractError as exc:
            return Response(
                {
                    "detail": str(
                        exc
                    ),
                    "code": exc.code,
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        except (
            AgentCompletionStateError,
            AgentCompletionConflictError,
        ) as exc:
            return Response(
                {
                    "detail": str(
                        exc
                    ),
                    "code": exc.code,
                },
                status=(
                    status.HTTP_409_CONFLICT
                ),
            )

        except AgentCompletionStorageError as exc:
            return Response(
                {
                    "detail": (
                        "Le stockage de la photo "
                        "est temporairement indisponible."
                    ),
                    "code": exc.code,
                },
                status=(
                    status.HTTP_503_SERVICE_UNAVAILABLE
                ),
            )

        return Response(
            result,
            status=status.HTTP_200_OK,
        )
