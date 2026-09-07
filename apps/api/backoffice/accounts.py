import json
from typing import Any

from django.db import (
    connection,
    transaction,
)


VALID_VERIFICATION_METHODS = {
    "email",
    "phone",
    "document",
    "in_person",
    "other",
}


@transaction.atomic
def reactivate_account(
    *,
    user_id: str,
    actor_id: str,
    verification_method: str,
    verification_note: str,
) -> dict[str, Any]:
    """Réactive un compte utilisateur Adresse GN de façon atomique."""

    method = (verification_method or "").strip()
    note = (verification_note or "").strip()[:1000]

    if method not in VALID_VERIFICATION_METHODS:
        return {
            "ok": False,
            "status": "invalid_verification_method",
            "message": "Méthode de vérification d'identité invalide.",
        }

    if not note:
        return {
            "ok": False,
            "status": "missing_verification_note",
            "message": "La note de vérification d'identité est obligatoire.",
        }

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, role, account_status, deactivated_at
            FROM public.profiles
            WHERE id = %s
            FOR UPDATE
            """,
            [user_id],
        )
        profile = cursor.fetchone()

    if profile is None:
        return {
            "ok": False,
            "status": "not_found",
            "message": "Compte utilisateur introuvable.",
        }

    profile_id, role, account_status, deactivated_at = profile

    if role != "user":
        return {
            "ok": False,
            "status": "forbidden_target",
            "message": "Seuls les comptes utilisateur peuvent être réactivés par ce workflow.",
        }

    if account_status != "deactivated":
        return {
            "ok": False,
            "status": "not_deactivated",
            "message": "Ce compte n'est pas désactivé.",
        }

    before_payload = json.dumps({
        "account_status": account_status,
        "deactivated_at": deactivated_at.isoformat() if deactivated_at else None,
    })

    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE public.profiles
            SET account_status = 'active', deactivated_at = NULL
            WHERE id = %s AND account_status = 'deactivated'
            RETURNING account_status, deactivated_at
            """,
            [profile_id],
        )
        updated = cursor.fetchone()

    if updated is None:
        return {
            "ok": False,
            "status": "conflict",
            "message": "L'état du compte a changé pendant la réactivation.",
        }

    after_payload = json.dumps({
        "account_status": updated[0],
        "deactivated_at": None,
        "verification_method": method,
        "verification_note": note,
    })

    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO public.audit_logs
                (actor_id, action, entity, entity_id, before, after)
            VALUES
                (%s, 'account_reactivated', 'profile', %s, %s::jsonb, %s::jsonb)
            RETURNING id
            """,
            [actor_id, profile_id, before_payload, after_payload],
        )
        audit_id = cursor.fetchone()[0]

    return {
        "ok": True,
        "status": "reactivated",
        "user_id": str(profile_id),
        "account_status": updated[0],
        "deactivated_at": None,
        "audit_id": str(audit_id),
        "verification_method": method,
        "message": "Compte réactivé. L'utilisateur peut se reconnecter.",
    }

VALID_ACCOUNT_STATUS_FILTERS = {
    "active",
    "deactivated",
}


def _mask_email(
    value: str | None,
) -> str | None:
    if not value or "@" not in value:
        return None

    local, domain = value.split("@", 1)
    local_masked = (
        local[:1] + "***"
        if len(local) <= 2
        else local[:2] + "***"
    )
    return local_masked + "@" + domain


def list_accounts(
    *,
    status_filter: str | None,
    query: str | None,
) -> dict[str, Any]:
    normalized_status = (
        status_filter or "deactivated"
    ).strip()

    if (
        normalized_status != "all"
        and normalized_status
        not in VALID_ACCOUNT_STATUS_FILTERS
    ):
        raise ValueError(
            "Statut de compte invalide."
        )

    q = (query or "").strip()[:120]

    where_parts = [
        "p.role = 'user'",
    ]
    params: list[Any] = []

    if normalized_status != "all":
        where_parts.append(
            "p.account_status = %s"
        )
        params.append(normalized_status)

    if q:
        like = f"%{q}%"
        where_parts.append(
            """
            (
                p.id::text ILIKE %s
                OR COALESCE(p.full_name, '') ILIKE %s
                OR COALESCE(p.phone, '') ILIKE %s
                OR COALESCE(u.email, '') ILIKE %s
            )
            """
        )
        params.extend(
            [like, like, like, like]
        )

    where_sql = " AND ".join(
        where_parts
    )

    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT
                p.id,
                p.full_name,
                p.phone,
                p.role,
                p.account_status,
                p.deactivated_at,
                u.email
            FROM public.profiles p
            LEFT JOIN auth.users u
                ON u.id = p.id
            WHERE {where_sql}
            ORDER BY
                CASE
                    WHEN p.account_status = 'deactivated'
                    THEN 0
                    ELSE 1
                END,
                p.deactivated_at DESC NULLS LAST,
                p.id
            LIMIT 100
            """,
            params,
        )
        rows = cursor.fetchall()

    items = []

    for row in rows:
        (
            profile_id,
            full_name,
            phone,
            role,
            account_status,
            deactivated_at,
            email,
        ) = row

        items.append(
            {
                "id": str(profile_id),
                "full_name": full_name or None,
                "phone": phone or None,
                "role": role,
                "account_status": account_status,
                "deactivated_at": (
                    deactivated_at.isoformat()
                    if deactivated_at
                    else None
                ),
                "email_masked": (
                    _mask_email(email)
                ),
            }
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                account_status,
                COUNT(*)
            FROM public.profiles
            WHERE role = 'user'
            GROUP BY account_status
            """
        )

        counts = {
            "active": 0,
            "deactivated": 0,
        }

        for status_value, count in cursor.fetchall():
            if status_value in counts:
                counts[status_value] = int(count)

    return {
        "items": items,
        "counts": counts,
        "status_filter": normalized_status,
        "query": q or None,
    }
