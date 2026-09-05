from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


class AuthMeView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    @extend_schema(
        tags=["Auth"],
        description=(
            "Vérifie le JWT Supabase transmis en Bearer "
            "et retourne l'identité validée par Django."
        ),
    )
    def get(self, request):
        return Response(
            {
                "authenticated": True,
                "user": {
                    "id": request.user.id,
                    "email": (
                        request.user.email
                    ),
                    "role": (
                        request.user.role
                    ),
                },
            }
        )
