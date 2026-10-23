from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .action_common import ActionError
from .global_actions import execute_action, get_action_catalog
from .permissions import IsBackofficeUser


class BackofficeActionCatalogView(APIView):
    permission_classes = [IsAuthenticated, IsBackofficeUser]

    @extend_schema(
        tags=["Back-office"],
        description=(
            "Retourne le catalogue d'actions autorisées pour une ressource "
            "selon le rôle métier courant. Lecture seule."
        ),
    )
    def get(self, request, resource):
        try:
            result = get_action_catalog(request, resource=resource)
        except ActionError as exc:
            return Response(
                {"ok": False, "status": exc.status, "message": str(exc)},
                status=exc.http_status,
            )
        return Response(result, status=status.HTTP_200_OK)


class BackofficeActionExecuteView(APIView):
    permission_classes = [IsAuthenticated, IsBackofficeUser]

    @extend_schema(
        tags=["Back-office"],
        description=(
            "Exécute une action métier autorisée. Les workflows V1 existants "
            "restent l'autorité lorsqu'ils existent."
        ),
    )
    def post(self, request, resource, action):
        if request.FILES:
            payload = request.data
            row_id = payload.get("row_id")
            data = {
                key: payload.get(key)
                for key in payload.keys()
                if key != "row_id"
            }
            for key, file_obj in request.FILES.items():
                data[key] = file_obj
        else:
            payload = request.data if isinstance(request.data, dict) else {}
            row_id = payload.get("row_id")
            data = payload.get("data")
            if not isinstance(data, dict):
                data = {}
        try:
            result = execute_action(
                request,
                resource=resource,
                action=action,
                row_id=str(row_id) if row_id else None,
                data=data,
            )
        except ActionError as exc:
            return Response(
                {"ok": False, "status": exc.status, "message": str(exc)},
                status=exc.http_status,
            )
        except Exception:
            return Response(
                {
                    "ok": False,
                    "status": "error",
                    "message": "L'action n'a pas pu être exécutée.",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response(result, status=status.HTTP_200_OK)
