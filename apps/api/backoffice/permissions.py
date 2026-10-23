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


INSTALLATION_OPERATION_ROLES = {
    "admin",
    "super_admin",
}


class IsInstallationBackofficeUser(
    BasePermission
):
    """
    Autorise les opérations physiques sensibles
    sur les installations Adresse GN.

    Le rôle métier est toujours relu dans profiles.
    """

    message = (
        "Accès refusé : opération réservée "
        "aux administrateurs Adresse GN."
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

        if role not in (
            INSTALLATION_OPERATION_ROLES
        ):
            return False

        request.backoffice_identity = {
            "user_id": str(row[0]),
            "role": role,
            "full_name": row[2],
        }

        return True


BACKOFFICE_ROLES = {
    "support",
    "sales",
    "ops",
    "supervisor",
    "admin",
    "super_admin",
}


class IsBackofficeUser(BasePermission):
    """
    Autorise les rôles métier disposant d'un espace
    back-office Adresse GN.

    Le JWT Supabase ne porte que le rôle technique
    "authenticated". Le rôle métier est donc toujours
    relu côté serveur dans public.profiles.

    Les comptes propriétaires "user" et les agents
    terrain "agent" ne font pas partie du back-office.
    """

    message = (
        "Accès refusé : espace réservé "
        "au back-office Adresse GN."
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

        if role not in BACKOFFICE_ROLES:
            return False

        request.backoffice_identity = {
            "user_id": str(row[0]),
            "role": role,
            "full_name": row[2],
        }

        return True

DASHBOARD_BACKOFFICE_ROLES = {
    "supervisor",
    "admin",
    "super_admin",
}


class IsDashboardBackofficeUser(BasePermission):
    """
    Dashboard opérationnel partagé historiquement
    entre Supervisor, Admin et Super Admin.
    """

    message = (
        "Accès refusé : tableau de bord réservé "
        "aux superviseurs et administrateurs Adresse GN."
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

        if role not in DASHBOARD_BACKOFFICE_ROLES:
            return False

        request.backoffice_identity = {
            "user_id": str(row[0]),
            "role": role,
            "full_name": row[2],
        }

        return True