from __future__ import annotations

from django.db import connection
from rest_framework.permissions import BasePermission


SALES_ROLES = {
    "sales",
    "admin",
    "super_admin",
}


def get_application_role(
    user_id: str,
) -> str | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT role
            FROM public.profiles
            WHERE
                id = %s
                AND account_status = 'active'
            LIMIT 1
            """,
            [user_id],
        )

        row = cursor.fetchone()

    if row is None:
        return None

    return str(row[0])


def require_sales_role(
    user_id: str,
) -> str:
    role = get_application_role(
        user_id
    )

    if role not in SALES_ROLES:
        raise PermissionError(
            "Accès réservé à l'équipe commerciale."
        )

    return role


class IsSalesTeam(
    BasePermission
):
    message = (
        "Accès réservé à l'équipe commerciale."
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

        role = get_application_role(
            str(user_id)
        )

        return role in SALES_ROLES
