from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    StateToStateRouteSerializer,
)
from .services import (
    RoutingBackendError,
    RoutingBackendNotConfigured,
    route_state_to_state,
)


class InternalStateToStateRouteView(
    APIView
):
    """
    Internal state-to-state routing contract.

    IMPORTANT:
    - authentication is mandatory;
    - this view is not mounted in config.urls;
    - no GPS snapping is performed here;
    - no route geometry is returned here;
    - the only frozen routing profile is "car".
    """

    permission_classes = [
        IsAuthenticated,
    ]

    @extend_schema(
        tags=["Internal Routing"],
        request=StateToStateRouteSerializer,
        description=(
            "Contrat interne de routage entre deux "
            "state_id du graphe voiture validé. "
            "Ne réalise ni snap GPS ni sérialisation "
            "de géométrie d'itinéraire."
        ),
    )
    def post(
        self,
        request,
    ):
        serializer = (
            StateToStateRouteSerializer(
                data=request.data,
            )
        )

        serializer.is_valid(
            raise_exception=True,
        )

        start_state_id = (
            serializer.validated_data[
                "start_state_id"
            ]
        )

        end_state_id = (
            serializer.validated_data[
                "end_state_id"
            ]
        )

        try:
            result = route_state_to_state(
                start_state_id=(
                    start_state_id
                ),
                end_state_id=(
                    end_state_id
                ),
            )

        except RoutingBackendNotConfigured:
            return Response(
                {
                    "status": "error",
                    "code": (
                        "routing_backend_unavailable"
                    ),
                    "message": (
                        "Le moteur de routage interne "
                        "n'est pas disponible."
                    ),
                },
                status=(
                    status
                    .HTTP_503_SERVICE_UNAVAILABLE
                ),
            )

        except RoutingBackendError:
            return Response(
                {
                    "status": "error",
                    "code": (
                        "routing_backend_invalid_response"
                    ),
                    "message": (
                        "Le moteur de routage interne "
                        "a renvoyé une réponse invalide."
                    ),
                },
                status=(
                    status.HTTP_502_BAD_GATEWAY
                ),
            )

        return Response(
            {
                "status": "ok",
                "profile": "car",
                "start_state_id": (
                    result[
                        "start_state_id"
                    ]
                ),
                "end_state_id": (
                    result[
                        "end_state_id"
                    ]
                ),
                "reachable": (
                    result["reachable"]
                ),
                "total_cost": (
                    result["total_cost"]
                ),
            },
            status=status.HTTP_200_OK,
        )