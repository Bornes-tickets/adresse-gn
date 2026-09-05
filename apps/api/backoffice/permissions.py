from django.db import connection
from rest_framework.permissions import BasePermission


BACKOFFICE_CLAIM_ROLES = {
    "support",
    "admin",
    "super_admin",
}


class IsClaimBackofficeUser(BasePermission):
    """
    Autorise uniquement les rôles métier pouvant traiter
    les revendications d'adresses.

    Le rôle JWT Supabase reste "authenticated".
    Le rôle métier est donc relu côté serveur dans profiles.
    """

    message = (
        "Accès refusé : espace réservé "
        "au support Adresse GN."
    )

    def has_permission(
        self,
        request,
        view,
    ) -> bool:
        user_id = getattr(
            request.user,
            "id",
            None,
        )

        if not user_id:
            return False

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    id,
                    role,
                    full_name
                FROM public.profiles
                WHERE id = %s
                LIMIT 1
                """,
                [
                    user_id,
                ],
            )

            row = cursor.fetchone()

        if row is None:
            return False

        role = row[1]

        if role not in BACKOFFICE_CLAIM_ROLES:
            return False

        request.backoffice_identity = {
            "user_id": str(row[0]),
            "role": role,
            "full_name": row[2],
        }

        return True