from django.db import connection
from rest_framework.permissions import BasePermission


class IsActiveFieldAgent(BasePermission):
    """
    Autorise uniquement un agent terrain actif.

    L'identité cryptographique vient du JWT Supabase déjà validé
    par SupabaseJWTAuthentication.

    Le rôle métier et l'état de l'agent sont relus côté serveur.
    """

    message = (
        "Accès refusé : espace réservé "
        "aux agents terrain actifs Adresse GN."
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
                    p.id,
                    p.role,
                    p.full_name,
                    a.badge_number,
                    a.zone_id,
                    a.active
                FROM public.profiles p
                JOIN public.agents a
                  ON a.id = p.id
                WHERE p.id = %s
                LIMIT 1
                """,
                [
                    user_id,
                ],
            )

            row = cursor.fetchone()

        if row is None:
            return False

        (
            profile_id,
            role,
            full_name,
            badge_number,
            zone_id,
            active,
        ) = row

        if str(role) != "agent":
            return False

        if active is not True:
            return False

        request.agent_identity = {
            "user_id": str(profile_id),
            "role": "agent",
            "full_name": full_name,
            "badge_number": (
                str(badge_number)
                if badge_number is not None
                else None
            ),
            "zone_id": (
                str(zone_id)
                if zone_id is not None
                else None
            ),
            "active": True,
        }

        return True
