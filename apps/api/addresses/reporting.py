from typing import Any

from django.db import connection

from .services import get_address_detail


REPORT_REASONS = {
    "wrong_location",
    "closed",
    "damaged_beacon",
    "other",
}


def create_address_report(
    raw_number: str,
    reporter_id: str,
    reason: str,
    description: str | None = None,
) -> dict[str, Any]:
    """
    Crée un signalement authentifié pour une Adresse GN.

    Le frontend ne fournit jamais reporter_id ni beacon_id.

    reporter_id provient du JWT Supabase validé par Django.
    beacon_id est résolu côté serveur depuis le numéro public.
    """

    normalized_reason = (
        str(reason or "")
        .strip()
        .lower()
    )

    if (
        normalized_reason
        not in REPORT_REASONS
    ):
        return {
            "ok": False,
            "status": "invalid",
            "report_id": None,
            "message": (
                "Motif de signalement invalide."
            ),
        }

    detail = get_address_detail(
        raw_number=raw_number,
    )

    if detail["status"] == "invalid":
        return {
            "ok": False,
            "status": "invalid",
            "report_id": None,
            "message": (
                "Numéro Adresse GN invalide."
            ),
        }

    beacon_id = detail.get(
        "beacon_id",
    )

    if (
        detail["status"] != "found"
        or not beacon_id
    ):
        return {
            "ok": False,
            "status": "not_found",
            "report_id": None,
            "message": (
                "Adresse introuvable."
            ),
        }

    cleaned_description = (
        str(description or "")
        .strip()
        or None
    )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT 1
            FROM public.profiles
            WHERE id = %s
            LIMIT 1
            """,
            [
                reporter_id,
            ],
        )

        if cursor.fetchone() is None:
            return {
                "ok": False,
                "status": "profile_missing",
                "report_id": None,
                "message": (
                    "Le profil utilisateur "
                    "Adresse GN est introuvable."
                ),
            }

        cursor.execute(
            """
            INSERT INTO public.reports
                (
                    beacon_id,
                    reporter_id,
                    reason,
                    description
                )
            VALUES
                (
                    %s,
                    %s,
                    %s,
                    %s
                )
            RETURNING
                id,
                status,
                created_at
            """,
            [
                beacon_id,
                reporter_id,
                normalized_reason,
                cleaned_description,
            ],
        )

        row = cursor.fetchone()

    return {
        "ok": True,
        "status": "created",
        "report_id": str(row[0]),
        "report_status": row[1],
        "created_at": (
            row[2].isoformat()
            if row[2]
            else None
        ),
        "message": (
            "Merci, votre signalement "
            "a été transmis."
        ),
    }