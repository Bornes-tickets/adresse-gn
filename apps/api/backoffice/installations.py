import json

from django.db import (
    connection,
    transaction,
)


@transaction.atomic
def register_installation_uninstall(
    *,
    installation_id: str,
    actor_id: str,
    agent_id: str,
    reason: str,
    photo_url: str | None = None,
) -> dict:
    """
    Enregistre le retrait physique d'une installation legacy.

    L'installation d'origine reste conservée.
    Le beacon historique reste legacy / suspended.
    """

    reason_clean = str(
        reason or ""
    ).strip()

    photo_clean = (
        str(photo_url or "").strip()
        or None
    )

    if not reason_clean:
        return {
            "ok": False,
            "status": "invalid_reason",
            "message": (
                "Le motif du retrait est obligatoire."
            ),
        }

    with connection.cursor() as cursor:

        # ----------------------------------------------------
        # Verrouillage installation + beacon
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                i.id,
                i.beacon_id,
                i.uninstalled_at,
                i.uninstalled_by_agent_id,
                i.uninstall_reason,
                i.uninstall_photo_url,
                b.public_number,
                b.status,
                b.numbering_version
            FROM public.installations i
            JOIN public.beacons b
              ON b.id = i.beacon_id
            WHERE i.id = %s
            FOR UPDATE OF i, b
            """,
            [
                installation_id,
            ],
        )

        row = cursor.fetchone()

        if row is None:
            return {
                "ok": False,
                "status": "not_found",
                "message": (
                    "Installation introuvable."
                ),
            }

        (
            locked_installation_id,
            beacon_id,
            previous_uninstalled_at,
            previous_agent_id,
            previous_reason,
            previous_photo_url,
            public_number,
            beacon_status,
            numbering_version,
        ) = row

        # ----------------------------------------------------
        # Installation déjà retirée
        # ----------------------------------------------------

        if previous_uninstalled_at is not None:
            return {
                "ok": False,
                "status": "already_uninstalled",
                "message": (
                    "Cette installation a déjà "
                    "été démontée."
                ),
            }

        # ----------------------------------------------------
        # Cette opération C2 ne concerne que le legacy
        # ----------------------------------------------------

        if numbering_version != "legacy":
            return {
                "ok": False,
                "status": "invalid_numbering_version",
                "message": (
                    "Seules les installations legacy "
                    "peuvent être retirées par cette "
                    "opération."
                ),
            }

        if beacon_status != "suspended":
            return {
                "ok": False,
                "status": "invalid_beacon_state",
                "message": (
                    "La balise legacy doit être "
                    "suspendue avant son retrait."
                ),
            }

        # ----------------------------------------------------
        # Agent terrain
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                active
            FROM public.agents
            WHERE id = %s
            LIMIT 1
            """,
            [
                agent_id,
            ],
        )

        agent_row = cursor.fetchone()

        if agent_row is None:
            return {
                "ok": False,
                "status": "agent_not_found",
                "message": (
                    "Agent de retrait introuvable."
                ),
            }

        if agent_row[1] is not True:
            return {
                "ok": False,
                "status": "agent_inactive",
                "message": (
                    "L'agent de retrait est inactif."
                ),
            }

        # ----------------------------------------------------
        # Audit avant
        # ----------------------------------------------------

        before_payload = json.dumps(
            {
                "public_number": (
                    public_number
                ),
                "uninstalled_at": (
                    previous_uninstalled_at
                    .isoformat()
                    if previous_uninstalled_at
                    else None
                ),
                "uninstalled_by_agent_id": (
                    str(previous_agent_id)
                    if previous_agent_id
                    else None
                ),
                "uninstall_reason": (
                    previous_reason
                ),
                "uninstall_photo_url": (
                    previous_photo_url
                ),
            }
        )

        # ----------------------------------------------------
        # Retrait
        #
        # La condition supplémentaire protège également
        # contre un double traitement concurrent.
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE public.installations
            SET
                uninstalled_at = now(),
                uninstalled_by_agent_id = %s,
                uninstall_reason = %s,
                uninstall_photo_url = %s
            WHERE id = %s
              AND uninstalled_at IS NULL
            RETURNING
                uninstalled_at,
                uninstalled_by_agent_id,
                uninstall_reason,
                uninstall_photo_url
            """,
            [
                agent_id,
                reason_clean,
                photo_clean,
                locked_installation_id,
            ],
        )

        updated = cursor.fetchone()

        if updated is None:
            return {
                "ok": False,
                "status": "already_uninstalled",
                "message": (
                    "Cette installation a déjà "
                    "été démontée."
                ),
            }

        (
            uninstalled_at,
            uninstalled_by_agent_id,
            uninstall_reason,
            uninstall_photo_url,
        ) = updated

        # ----------------------------------------------------
        # Audit après
        # ----------------------------------------------------

        after_payload = json.dumps(
            {
                "public_number": (
                    public_number
                ),
                "beacon_id": str(
                    beacon_id
                ),
                "uninstalled_at": (
                    uninstalled_at.isoformat()
                ),
                "uninstalled_by_agent_id": str(
                    uninstalled_by_agent_id
                ),
                "uninstall_reason": (
                    uninstall_reason
                ),
                "uninstall_photo_url": (
                    uninstall_photo_url
                ),
            }
        )

        cursor.execute(
            """
            INSERT INTO public.audit_logs
                (
                    actor_id,
                    action,
                    entity,
                    entity_id,
                    before,
                    after
                )
            VALUES
                (
                    %s,
                    'installation.uninstall',
                    'installations',
                    %s,
                    %s::jsonb,
                    %s::jsonb
                )
            RETURNING id
            """,
            [
                actor_id,
                locked_installation_id,
                before_payload,
                after_payload,
            ],
        )

        audit_row = cursor.fetchone()

        if audit_row is None:
            raise RuntimeError(
                "Impossible de journaliser "
                "la désinstallation."
            )

        audit_id = audit_row[0]

    return {
        "ok": True,
        "status": "uninstalled",
        "installation_id": str(
            locked_installation_id
        ),
        "beacon_id": str(
            beacon_id
        ),
        "public_number": (
            public_number
        ),
        "uninstalled_at": (
            uninstalled_at.isoformat()
        ),
        "uninstalled_by_agent_id": str(
            uninstalled_by_agent_id
        ),
        "uninstall_reason": (
            uninstall_reason
        ),
        "uninstall_photo_url": (
            uninstall_photo_url
        ),
        "audit_id": str(
            audit_id
        ),
    }
