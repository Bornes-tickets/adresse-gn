from __future__ import annotations

import json
from typing import Any

from django.db import connection

from .action_common import (
    ActionError,
    audit,
    int_value,
    optional_text,
    required_text,
)
from .claims import decide_claim
from .physical_installation_workflow import (
    PhysicalWorkflowNotFoundError,
    PhysicalWorkflowStateError,
    validate_physical_installation,
)


REPORT_STATUSES = {"new", "in_review", "resolved", "rejected"}
PLAN_STATUSES = {"planned", "in_progress", "completed", "cancelled"}


def qc_draw(actor: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
    percent = int_value(data.get("percent"))
    if percent < 1 or percent > 100:
        raise ActionError("Le pourcentage doit être compris entre 1 et 100.")

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM public.installations i
            WHERE i.validated_at IS NULL
              AND i.uninstalled_at IS NULL
              AND i.installed_at >= NOW() - INTERVAL '30 days'
            """
        )
        total = int(cursor.fetchone()[0])
        if total == 0:
            return {"ok": True, "status": "empty", "created": 0, "eligible": 0}

        sample_size = max(1, round(total * percent / 100))
        cursor.execute(
            """
            SELECT i.beacon_id
            FROM public.installations i
            WHERE i.validated_at IS NULL
              AND i.uninstalled_at IS NULL
              AND i.beacon_id IS NOT NULL
              AND i.installed_at >= NOW() - INTERVAL '30 days'
              AND NOT EXISTS (
                    SELECT 1
                    FROM public.reports r
                    WHERE r.beacon_id = i.beacon_id
                      AND r.reason = 'qc_recheck'
                      AND r.status IN ('new', 'in_review')
              )
            ORDER BY random()
            LIMIT %s
            """,
            [sample_size],
        )
        beacon_ids = [row[0] for row in cursor.fetchall()]
        for beacon_id in beacon_ids:
            cursor.execute(
                """
                INSERT INTO public.reports
                    (beacon_id, reporter_id, reason, description, status)
                VALUES
                    (%s, %s, 'qc_recheck', %s, 'new')
                """,
                [beacon_id, actor["user_id"], f"Contrôle qualité tiré à {percent} %"],
            )
        audit(
            cursor,
            actor_id=actor["user_id"],
            action="qc.draw",
            entity="reports",
            entity_id=None,
            after={"percent": percent, "eligible": total, "created": len(beacon_ids)},
        )
    return {"ok": True, "status": "created", "eligible": total, "created": len(beacon_ids)}


def installation_validate(actor: dict[str, Any], row_id: str) -> dict[str, Any]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT i.beacon_id, b.numbering_version, pi.id
            FROM public.installations i
            JOIN public.beacons b ON b.id = i.beacon_id
            LEFT JOIN public.pending_installations pi
              ON pi.beacon_id = i.beacon_id
             AND pi.status = 'installed'
            WHERE i.id = %s
            """,
            [row_id],
        )
        row = cursor.fetchone()
    if not row:
        raise ActionError("Installation introuvable.", status="not_found", http_status=404)

    beacon_id, numbering_version, pending_id = row
    if numbering_version == "v1":
        if not pending_id:
            raise ActionError("Workflow V1 installé introuvable.")
        try:
            return validate_physical_installation(
                pending_installation_id=str(pending_id),
                actor_id=actor["user_id"],
            )
        except PhysicalWorkflowNotFoundError as exc:
            raise ActionError(str(exc), status="not_found", http_status=404) from exc
        except PhysicalWorkflowStateError as exc:
            raise ActionError(str(exc), status="conflict", http_status=409) from exc

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT validated_at, validator_id, agent_id
            FROM public.installations
            WHERE id = %s
            FOR UPDATE
            """,
            [row_id],
        )
        current = cursor.fetchone()
        if not current:
            raise ActionError("Installation introuvable.", status="not_found", http_status=404)
        if current[0] is not None:
            return {"ok": True, "status": "validated", "idempotent": True, "installation_id": row_id}

        cursor.execute(
            """
            UPDATE public.installations
            SET validated_at = NOW(), validator_id = %s
            WHERE id = %s
              AND validated_at IS NULL
              AND uninstalled_at IS NULL
            """,
            [actor["user_id"], row_id],
        )
        if cursor.rowcount != 1:
            raise ActionError("Installation modifiée concurremment.", status="conflict", http_status=409)

        cursor.execute(
            """
            UPDATE public.reports
            SET status = 'resolved'
            WHERE beacon_id = %s
              AND reason = 'qc_recheck'
              AND status IN ('new', 'in_review')
            """,
            [beacon_id],
        )
        if current[2]:
            cursor.execute(
                """
                INSERT INTO public.notifications (user_id, type, payload)
                VALUES (%s, 'installation_qc', %s::jsonb)
                """,
                [
                    current[2],
                    json.dumps({"installation_id": row_id, "decision": "validated"}),
                ],
            )
        audit(
            cursor,
            actor_id=actor["user_id"],
            action="installation.validate.legacy",
            entity="installations",
            entity_id=row_id,
            before={"validated_at": None},
            after={"validated": True},
        )
    return {"ok": True, "status": "validated", "installation_id": row_id}


def installation_reject(actor: dict[str, Any], row_id: str, data: dict[str, Any]) -> dict[str, Any]:
    note = required_text(data, "note", "Le motif")
    with connection.cursor() as cursor:
        cursor.execute("SELECT beacon_id, agent_id FROM public.installations WHERE id = %s", [row_id])
        row = cursor.fetchone()
        if not row:
            raise ActionError("Installation introuvable.", status="not_found", http_status=404)
        beacon_id, agent_id = row
        cursor.execute(
            """
            UPDATE public.reports
            SET status = 'rejected',
                description = CONCAT_WS(E'\\n', NULLIF(description, ''), %s)
            WHERE beacon_id = %s
              AND reason = 'qc_recheck'
              AND status IN ('new', 'in_review')
            """,
            [f"[QC] {note}", beacon_id],
        )
        if cursor.rowcount == 0:
            cursor.execute(
                """
                INSERT INTO public.reports
                    (beacon_id, reporter_id, reason, description, status)
                VALUES (%s, %s, 'qc_reject', %s, 'in_review')
                """,
                [beacon_id, actor["user_id"], note],
            )
        if agent_id:
            cursor.execute(
                """
                INSERT INTO public.notifications (user_id, type, payload)
                VALUES (%s, 'installation_qc', %s::jsonb)
                """,
                [
                    agent_id,
                    json.dumps({"installation_id": row_id, "decision": "rejected", "note": note}),
                ],
            )
        audit(
            cursor,
            actor_id=actor["user_id"],
            action="installation.qc.reject",
            entity="installations",
            entity_id=row_id,
            after={"note": note},
        )
    return {"ok": True, "status": "rejected", "installation_id": row_id}


def planning_create(actor: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
    beacon_id = required_text(data, "beacon_id", "La balise")
    scheduled_date = required_text(data, "scheduled_date", "La date")
    agent_id = optional_text(data, "agent_id")
    commune_id = optional_text(data, "commune_id")
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM public.beacons WHERE id = %s", [beacon_id])
        if cursor.fetchone() is None:
            raise ActionError("Balise introuvable.")
        if agent_id:
            cursor.execute("SELECT 1 FROM public.agents WHERE id = %s AND active IS TRUE", [agent_id])
            if cursor.fetchone() is None:
                raise ActionError("Agent actif introuvable.")
        if commune_id:
            cursor.execute("SELECT 1 FROM public.communes WHERE id = %s AND is_active IS TRUE", [commune_id])
            if cursor.fetchone() is None:
                raise ActionError("Commune active introuvable.")
        cursor.execute(
            """
            INSERT INTO public.installation_plans
                (beacon_id, agent_id, commune_id, scheduled_date,
                 address_hint, notes, status, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, 'planned', %s)
            RETURNING id
            """,
            [
                beacon_id, agent_id, commune_id, scheduled_date,
                optional_text(data, "address_hint"), optional_text(data, "notes"), actor["user_id"],
            ],
        )
        plan_id = cursor.fetchone()[0]
        audit(
            cursor,
            actor_id=actor["user_id"],
            action="installation_plan.create",
            entity="installation_plans",
            entity_id=str(plan_id),
            after={"beacon_id": beacon_id, "scheduled_date": scheduled_date},
        )
    return {"ok": True, "status": "created", "plan_id": str(plan_id)}


def planning_update(actor: dict[str, Any], row_id: str, data: dict[str, Any]) -> dict[str, Any]:
    status = required_text(data, "status", "Le statut")
    if status not in PLAN_STATUSES:
        raise ActionError("Statut de planification invalide.")
    scheduled_date = required_text(data, "scheduled_date", "La date")
    agent_id = optional_text(data, "agent_id")
    commune_id = optional_text(data, "commune_id")

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT agent_id, commune_id, scheduled_date, address_hint, notes, status
            FROM public.installation_plans
            WHERE id = %s
            FOR UPDATE
            """,
            [row_id],
        )
        before = cursor.fetchone()
        if not before:
            raise ActionError("Planification introuvable.", status="not_found", http_status=404)
        if agent_id:
            cursor.execute("SELECT 1 FROM public.agents WHERE id = %s AND active IS TRUE", [agent_id])
            if cursor.fetchone() is None:
                raise ActionError("Agent actif introuvable.")
        if commune_id:
            cursor.execute("SELECT 1 FROM public.communes WHERE id = %s AND is_active IS TRUE", [commune_id])
            if cursor.fetchone() is None:
                raise ActionError("Commune active introuvable.")
        cursor.execute(
            """
            UPDATE public.installation_plans
            SET agent_id = %s, commune_id = %s, scheduled_date = %s,
                address_hint = %s, notes = %s, status = %s, updated_at = NOW()
            WHERE id = %s
            """,
            [
                agent_id, commune_id, scheduled_date,
                optional_text(data, "address_hint"), optional_text(data, "notes"), status, row_id,
            ],
        )
        audit(
            cursor,
            actor_id=actor["user_id"],
            action="installation_plan.update",
            entity="installation_plans",
            entity_id=row_id,
            before={
                "agent_id": str(before[0]) if before[0] else None,
                "commune_id": str(before[1]) if before[1] else None,
                "scheduled_date": str(before[2]),
                "status": before[5],
            },
            after={
                "agent_id": agent_id,
                "commune_id": commune_id,
                "scheduled_date": scheduled_date,
                "status": status,
            },
        )
    return {"ok": True, "status": "updated", "plan_id": row_id}


def planning_delete(actor: dict[str, Any], row_id: str) -> dict[str, Any]:
    with connection.cursor() as cursor:
        cursor.execute("SELECT status, beacon_id FROM public.installation_plans WHERE id = %s FOR UPDATE", [row_id])
        row = cursor.fetchone()
        if not row:
            raise ActionError("Planification introuvable.", status="not_found", http_status=404)
        if row[0] == "completed":
            raise ActionError("Une planification terminée ne peut pas être supprimée.")
        audit(
            cursor,
            actor_id=actor["user_id"],
            action="installation_plan.delete",
            entity="installation_plans",
            entity_id=row_id,
            before={"status": row[0], "beacon_id": str(row[1]) if row[1] else None},
        )
        cursor.execute("DELETE FROM public.installation_plans WHERE id = %s", [row_id])
    return {"ok": True, "status": "deleted", "plan_id": row_id}


def report_update(actor: dict[str, Any], row_id: str, data: dict[str, Any]) -> dict[str, Any]:
    status = required_text(data, "status", "Le statut")
    comment = optional_text(data, "comment", max_length=2000)
    if status not in REPORT_STATUSES:
        raise ActionError("Statut de signalement invalide.")

    with connection.cursor() as cursor:
        cursor.execute("SELECT status, description, reporter_id FROM public.reports WHERE id = %s FOR UPDATE", [row_id])
        before = cursor.fetchone()
        if not before:
            raise ActionError("Signalement introuvable.", status="not_found", http_status=404)
        description = before[1]
        if comment:
            description = "\n".join(part for part in [description, f"[Backoffice] {comment}"] if part)
        cursor.execute("UPDATE public.reports SET status = %s, description = %s WHERE id = %s", [status, description, row_id])
        if before[2]:
            cursor.execute(
                "INSERT INTO public.notifications (user_id, type, payload) VALUES (%s, 'report_update', %s::jsonb)",
                [before[2], json.dumps({"report_id": row_id, "status": status, "comment": comment})],
            )
        audit(
            cursor,
            actor_id=actor["user_id"],
            action="report.update",
            entity="reports",
            entity_id=row_id,
            before={"status": before[0], "description": before[1]},
            after={"status": status, "comment": comment},
        )
    return {"ok": True, "status": status, "report_id": row_id}


def claim_decide(actor: dict[str, Any], row_id: str, data: dict[str, Any]) -> dict[str, Any]:
    result = decide_claim(
        claim_id=row_id,
        decision=required_text(data, "decision", "La décision"),
        note=optional_text(data, "note"),
        actor_id=actor["user_id"],
    )
    if not result.get("ok"):
        raise ActionError(result.get("message", "Décision impossible."), status=result.get("status", "invalid"))
    return result
