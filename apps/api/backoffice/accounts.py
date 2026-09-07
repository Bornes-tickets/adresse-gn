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
