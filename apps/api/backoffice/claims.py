import json
from typing import Any

from django.db import (
    connection,
    transaction,
)


VALID_CLAIM_STATUSES = {
    "pending",
    "approved",
    "rejected",
}


def _iso(value):
    if value is None:
        return None

    return value.isoformat()


def _parse_evidence(
    evidence: str | None,
) -> dict[str, str | None]:
    """
    Extrait les informations du formulaire historique :

        Propriétaire déclaré : ...
        Téléphone : ...
        <motif>

        Preuve : <URL>

    Ces valeurs servent uniquement à la présentation
    de la demande dans le back-office.
    """

    if not evidence:
        return {
            "owner_name": None,
            "owner_phone": None,
            "reason": None,
            "proof_url": None,
        }

    content = evidence
    proof_url = None

    proof_marker = "\n\nPreuve : "

    if proof_marker in content:
        content, proof_url = content.split(
            proof_marker,
            1,
        )

    elif "Preuve : " in content:
        content, proof_url = content.rsplit(
            "Preuve : ",
            1,
        )

    owner_name = None
    owner_phone = None
    reason_lines: list[str] = []

    for raw_line in content.splitlines():
        line = raw_line.strip()

        if not line:
            continue

        if line.startswith(
            "Propriétaire déclaré :"
        ):
            value = line.split(
                ":",
                1,
            )[1].strip()

            owner_name = (
                value or None
            )

            continue

        if line.startswith(
            "Téléphone :"
        ):
            value = line.split(
                ":",
                1,
            )[1].strip()

            owner_phone = (
                value or None
            )

            continue

        reason_lines.append(
            line
        )

    reason = (
        "\n".join(
            reason_lines
        ).strip()
        or None
    )

    return {
        "owner_name": owner_name,
        "owner_phone": owner_phone,
        "reason": reason,
        "proof_url": (
            proof_url.strip()
            if proof_url
            else None
        ),
    }


def list_claims(
    status_filter: str | None,
) -> dict[str, Any]:
    if (
        status_filter is not None
        and status_filter
        not in VALID_CLAIM_STATUSES
    ):
        raise ValueError(
            "Statut de revendication invalide."
        )

    params: list[Any] = []
    where_sql = ""

    if status_filter:
        where_sql = (
            "WHERE cr.status = %s"
        )

        params.append(
            status_filter
        )

    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT
                cr.id,
                cr.status,
                cr.evidence,
                cr.decision_note,
                cr.created_at,
                cr.decided_at,
                cr.decided_by,
                cr.beacon_id,
                b.public_number,
                cr.requester_id,
                p.full_name,
                p.phone,
                cr.unclaimed_owner_id,
                u.name,
                u.phone
            FROM public.claim_requests cr
            JOIN public.beacons b
                ON b.id = cr.beacon_id
            LEFT JOIN public.profiles p
                ON p.id = cr.requester_id
            LEFT JOIN public.unclaimed_owners u
                ON u.id = cr.unclaimed_owner_id
            {where_sql}
            ORDER BY cr.created_at DESC
            LIMIT 200
            """,
            params,
        )

        rows = cursor.fetchall()

    claims = []

    for row in rows:
        (
            claim_id,
            claim_status,
            evidence,
            decision_note,
            created_at,
            decided_at,
            decided_by,
            beacon_id,
            beacon_number,
            requester_id,
            requester_name,
            requester_phone,
            unclaimed_owner_id,
            unclaimed_owner_name,
            unclaimed_owner_phone,
        ) = row

        parsed_evidence = (
            _parse_evidence(
                evidence
            )
        )

        reason = (
            parsed_evidence[
                "reason"
            ]
        )

        proof_url = (
            parsed_evidence[
                "proof_url"
            ]
        )

        declared_owner_name = (
            parsed_evidence[
                "owner_name"
            ]
        )

        declared_owner_phone = (
            parsed_evidence[
                "owner_phone"
            ]
        )

        unclaimed_owner = None

        if unclaimed_owner_id:
            unclaimed_owner = {
                "id": str(
                    unclaimed_owner_id
                ),
                "name": (
                    unclaimed_owner_name
                ),
                "phone": (
                    unclaimed_owner_phone
                ),
            }

        claims.append(
            {
                "id": str(claim_id),
                "status": claim_status,
                "evidence": evidence,
                "reason": reason,
                "proof_url": proof_url,
                "decision_note": (
                    decision_note
                ),
                "created_at": _iso(
                    created_at
                ),
                "decided_at": _iso(
                    decided_at
                ),
                "decided_by": (
                    str(decided_by)
                    if decided_by
                    else None
                ),
                "beacon_id": str(
                    beacon_id
                ),
                "beacon_number": (
                    beacon_number
                ),
                "requester_id": str(
                    requester_id
                ),
                "requester_name": (
                    requester_name
                    or declared_owner_name
                ),
                "requester_phone": (
                    requester_phone
                    or declared_owner_phone
                ),
                "requester_email": None,
                "unclaimed_owner": (
                    unclaimed_owner
                ),
            }
        )

    counts = {
        "pending": 0,
        "approved": 0,
        "rejected": 0,
    }

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                status,
                COUNT(*)
            FROM public.claim_requests
            GROUP BY status
            """
        )

        for claim_status, count in (
            cursor.fetchall()
        ):
            if claim_status in counts:
                counts[
                    claim_status
                ] = int(count)

    return {
        "items": claims,
        "counts": counts,
    }


@transaction.atomic
def decide_claim(
    *,
    claim_id: str,
    decision: str,
    note: str | None,
    actor_id: str,
) -> dict[str, Any]:
    """
    Traite une revendication de façon atomique.

    Important :
    - la demande est verrouillée FOR UPDATE ;
    - l'adresse est également verrouillée lors
      d'une approbation ;
    - requester_id vient de la demande en base ;
    - actor_id vient exclusivement du JWT validé ;
    - verification_level est volontairement conservé.
    """

    if decision not in {
        "approved",
        "rejected",
    }:
        return {
            "ok": False,
            "status": "invalid_decision",
            "message": (
                "Décision invalide."
            ),
        }

    note_clean = (
        (note or "")
        .strip()[:500]
        or None
    )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                cr.id,
                cr.beacon_id,
                cr.requester_id,
                cr.status,
                b.public_number
            FROM public.claim_requests cr
            JOIN public.beacons b
                ON b.id = cr.beacon_id
            WHERE cr.id = %s
            FOR UPDATE OF cr
            """,
            [
                claim_id,
            ],
        )

        claim = cursor.fetchone()

        if claim is None:
            return {
                "ok": False,
                "status": "not_found",
                "message": (
                    "Demande introuvable."
                ),
            }

        (
            locked_claim_id,
            beacon_id,
            requester_id,
            current_status,
            public_number,
        ) = claim

        if current_status != "pending":
            return {
                "ok": False,
                "status": (
                    "already_processed"
                ),
                "message": (
                    "Cette demande a déjà "
                    "été traitée."
                ),
            }

        address_id = None
        previous_owner_id = None
        verification_level = None

        if decision == "approved":
            cursor.execute(
                """
                SELECT
                    id,
                    owner_id,
                    verification_level
                FROM public.addresses
                WHERE beacon_id = %s
                LIMIT 1
                FOR UPDATE
                """,
                [
                    beacon_id,
                ],
            )

            address = cursor.fetchone()

            if address is None:
                return {
                    "ok": False,
                    "status": (
                        "address_missing"
                    ),
                    "message": (
                        "Aucune adresse n'est "
                        "rattachée à cette balise."
                    ),
                }

            (
                address_id,
                previous_owner_id,
                verification_level,
            ) = address

            if (
                previous_owner_id is not None
                and str(previous_owner_id)
                != str(requester_id)
            ):
                return {
                    "ok": False,
                    "status": (
                        "already_owned"
                    ),
                    "message": (
                        "Cette adresse possède "
                        "déjà un autre propriétaire."
                    ),
                }

            cursor.execute(
                """
                UPDATE public.addresses
                SET owner_id = %s
                WHERE id = %s
                """,
                [
                    requester_id,
                    address_id,
                ],
            )

            before_payload = json.dumps(
                {
                    "owner_id": (
                        str(
                            previous_owner_id
                        )
                        if previous_owner_id
                        else None
                    ),
                    "verification_level": (
                        verification_level
                    ),
                }
            )

            after_payload = json.dumps(
                {
                    "owner_id": str(
                        requester_id
                    ),
                    "verification_level": (
                        verification_level
                    ),
                    "claim_id": str(
                        locked_claim_id
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
                        'claim_approved',
                        'addresses',
                        %s,
                        %s::jsonb,
                        %s::jsonb
                    )
                """,
                [
                    actor_id,
                    address_id,
                    before_payload,
                    after_payload,
                ],
            )

        else:
            after_payload = json.dumps(
                {
                    "note": note_clean,
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
                        after
                    )
                VALUES
                    (
                        %s,
                        'claim_rejected',
                        'claim_requests',
                        %s,
                        %s::jsonb
                    )
                """,
                [
                    actor_id,
                    locked_claim_id,
                    after_payload,
                ],
            )

        cursor.execute(
            """
            UPDATE public.claim_requests
            SET
                status = %s,
                decision_note = %s,
                decided_at = NOW(),
                decided_by = %s
            WHERE id = %s
            RETURNING
                status,
                decided_at,
                decided_by
            """,
            [
                decision,
                note_clean,
                actor_id,
                locked_claim_id,
            ],
        )

        updated = cursor.fetchone()

        notification_payload = (
            json.dumps(
                {
                    "claim_id": str(
                        locked_claim_id
                    ),
                    "status": decision,
                    "note": note_clean,
                }
            )
        )

        cursor.execute(
            """
            INSERT INTO public.notifications
                (
                    user_id,
                    type,
                    payload
                )
            VALUES
                (
                    %s,
                    'claim_decision',
                    %s::jsonb
                )
            """,
            [
                requester_id,
                notification_payload,
            ],
        )

    return {
        "ok": True,
        "status": "decided",
        "claim_id": str(
            locked_claim_id
        ),
        "decision": updated[0],
        "decided_at": _iso(
            updated[1]
        ),
        "decided_by": str(
            updated[2]
        ),
        "beacon_number": (
            public_number
        ),
        "requester_id": str(
            requester_id
        ),
        "address_id": (
            str(address_id)
            if address_id
            else None
        ),
        "message": (
            "Décision enregistrée."
        ),
    }