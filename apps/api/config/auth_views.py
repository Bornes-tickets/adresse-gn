from django.db import connection
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
        """
        Retourne l'identité Supabase validée avec le rôle métier
        faisant autorité dans public.profiles.

        Le claim JWT `role` reste volontairement le rôle technique
        Supabase (`authenticated`) et ne doit jamais être utilisé
        pour router les espaces métier Adresse GN.
        """

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    role,
                    full_name
                FROM public.profiles
                WHERE id = %s
                LIMIT 1
                """,
                [
                    request.user.id,
                ],
            )

            row = cursor.fetchone()

        if row is None:
            return Response(
                {
                    "authenticated": False,
                    "detail": (
                        "Profil utilisateur Adresse GN "
                        "introuvable."
                    ),
                },
                status=401,
            )

        (
            business_role,
            full_name,
        ) = row

        return Response(
            {
                "authenticated": True,
                "user": {
                    "id": request.user.id,
                    "email": (
                        request.user.email
                    ),
                    "role": business_role,
                    "full_name": full_name,
                    "auth_role": (
                        request.user.role
                    ),
                },
            }
        )
