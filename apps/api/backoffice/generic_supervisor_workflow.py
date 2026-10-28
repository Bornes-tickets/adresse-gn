from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from django.db import connection, transaction

from .physical_installation_workflow import (
    PhysicalWorkflowNotFoundError,
    PhysicalWorkflowStateError,
    assign_physical_installation,
    reassign_physical_installation,
    schedule_physical_installation,
)


def generic_installation_task_exists(
    *,
    installation_task_id: str,
) -> bool:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM public.installation_tasks
                WHERE id = %s
            )
            """,
            [installation_task_id],
        )
        return bool(cursor.fetchone()[0])


def _load_task_for_update(
    *,
    installation_task_id: str,
) -> dict[str, Any] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                it.id,
                it.request_id,
                it.sequence_no,
                it.source_order_site_id,
                it.status,
                it.beacon_id,
                it.assigned_agent_id,
                it.installation_id,
                it.scheduled_at,
                it.installed_at,
                it.completed_at,
                it.category,
                it.commune_id,
                c.code AS commune_code,
                ir.status AS request_status,
                ir.source_type,
                ir.order_id,
                ir.reference
            FROM public.installation_tasks it
            JOIN public.installation_requests ir
              ON ir.id = it.request_id
            JOIN public.communes c
              ON c.id = it.commune_id
            WHERE it.id = %s
            FOR UPDATE OF it, ir
            """,
            [installation_task_id],
        )
        row = cursor.fetchone()

    if row is None:
        return None

    keys = (
        "id",
        "request_id",
        "sequence_no",
        "source_order_site_id",
        "status",
        "beacon_id",
        "assigned_agent_id",
        "installation_id",
        "scheduled_at",
        "installed_at",
        "completed_at",
        "category",
        "commune_id",
        "commune_code",
        "request_status",
        "source_type",
        "order_id",
        "reference",
    )
    return dict(zip(keys, row))


def _require_dispatchable_request(task: dict[str, Any]) -> None:
    if str(task["request_status"]) not in {
        "approved",
        "in_progress",
    }:
        raise PhysicalWorkflowStateError(
            "La demande générique doit être approuvée avant dispatch Supervisor."
        )


def _require_active_agent(*, agent_id: str) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM public.agents
                WHERE id = %s
                  AND active IS TRUE
            )
            """,
            [agent_id],
        )
        active = bool(cursor.fetchone()[0])

    if not active:
        raise PhysicalWorkflowStateError(
            "L agent sélectionné est introuvable ou inactif."
        )


def _load_stock_beacon_for_update(
    *,
    beacon_id: str,
) -> dict[str, Any]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                b.id,
                b.public_number,
                b.status,
                b.numbering_version,
                b.assigned_agent_id,
                b.category,
                b.commune_code_at_issue,
                b.lot_id
            FROM public.beacons b
            WHERE b.id = %s
            FOR UPDATE
            """,
            [beacon_id],
        )
        row = cursor.fetchone()

    if row is None:
        raise PhysicalWorkflowNotFoundError(
            "Balise de stock V1 introuvable."
        )

    keys = (
        "id",
        "public_number",
        "status",
        "numbering_version",
        "assigned_agent_id",
        "category",
        "commune_code_at_issue",
        "lot_id",
    )
    return dict(zip(keys, row))


def _require_compatible_available_stock(
    *,
    task: dict[str, Any],
    beacon: dict[str, Any],
) -> None:
    if str(beacon["numbering_version"]) != "v1":
        raise PhysicalWorkflowStateError(
            "Seule une balise V1 peut être utilisée."
        )
    if str(beacon["status"]) != "available":
        raise PhysicalWorkflowStateError(
            "La balise sélectionnée n est plus disponible."
        )
    if beacon["assigned_agent_id"] is not None:
        raise PhysicalWorkflowStateError(
            "La balise sélectionnée est déjà affectée."
        )
    if beacon["lot_id"] is None:
        raise PhysicalWorkflowStateError(
            "Une balise physique reçue et rattachée à un lot est obligatoire."
        )
    if str(beacon["category"]) != str(task["category"]):
        raise PhysicalWorkflowStateError(
            "La catégorie de la balise ne correspond pas à la tâche."
        )
    if str(beacon["commune_code_at_issue"]) != str(
        task["commune_code"]
    ):
        raise PhysicalWorkflowStateError(
            "La commune d émission de la balise ne correspond pas à la tâche."
        )


def _legacy_pending_for_order(
    *,
    order_id: str,
) -> dict[str, Any] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                status,
                beacon_id,
                assigned_agent_id,
                scheduled_at,
                completed_at
            FROM public.pending_installations
            WHERE order_id = %s
            FOR UPDATE
            """,
            [order_id],
        )
        row = cursor.fetchone()

    if row is None:
        return None

    keys = (
        "id",
        "status",
        "beacon_id",
        "assigned_agent_id",
        "scheduled_at",
        "completed_at",
    )
    return dict(zip(keys, row))


def _set_request_in_progress(*, request_id: str) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE public.installation_requests
            SET
                status = 'in_progress',
                updated_at = NOW()
            WHERE id = %s
              AND status = 'approved'
            """,
            [request_id],
        )


def _insert_audit(
    *,
    actor_id: str,
    action: str,
    task_id: str,
    before: dict[str, Any] | None,
    after: dict[str, Any],
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO public.audit_logs (
                actor_id,
                action,
                entity,
                entity_id,
                before,
                after
            )
            VALUES (
                %s,
                %s,
                'installation_tasks',
                %s,
                %s::jsonb,
                %s::jsonb
            )
            """,
            [
                actor_id,
                action,
                task_id,
                (
                    json.dumps(
                        before,
                        ensure_ascii=False,
                        default=str,
                    )
                    if before is not None
                    else None
                ),
                json.dumps(
                    after,
                    ensure_ascii=False,
                    default=str,
                ),
            ],
        )


def _assert_task_shape_for_initial_assignment(
    task: dict[str, Any],
) -> None:
    if str(task["status"]) != "pending":
        raise PhysicalWorkflowStateError(
            "Seule une tâche générique pending peut être affectée."
        )
    if (
        task["beacon_id"] is not None
        or task["assigned_agent_id"] is not None
        or task["scheduled_at"] is not None
        or task["installation_id"] is not None
        or task["installed_at"] is not None
        or task["completed_at"] is not None
    ):
        raise PhysicalWorkflowStateError(
            "Etat pending générique incohérent avant affectation."
        )


def _legacy_customer_order_pending(
    *,
    task: dict[str, Any],
) -> dict[str, Any]:
    if task["order_id"] is None:
        raise PhysicalWorkflowStateError(
            "La tâche customer_order doit référencer une commande."
        )
    if task["source_order_site_id"] is None:
        raise PhysicalWorkflowStateError(
            "La tâche customer_order doit référencer son site de commande."
        )

    legacy = _legacy_pending_for_order(
        order_id=str(task["order_id"])
    )
    if legacy is None:
        raise PhysicalWorkflowStateError(
            "Le bridge H2 customer_order est introuvable."
        )
    return legacy


@transaction.atomic
def assign_generic_installation_task(
    *,
    installation_task_id: str,
    actor_id: str,
    agent_id: str,
    stock_beacon_id: str,
) -> dict[str, Any]:
    task = _load_task_for_update(
        installation_task_id=installation_task_id
    )
    if task is None:
        raise PhysicalWorkflowNotFoundError(
            "Tâche générique à affecter introuvable."
        )

    _require_dispatchable_request(task)
    _require_active_agent(agent_id=agent_id)

    if str(task["status"]) == "assigned":
        if (
            str(task["assigned_agent_id"]) == str(agent_id)
            and str(task["beacon_id"]) == str(stock_beacon_id)
        ):
            beacon = _load_stock_beacon_for_update(
                beacon_id=str(task["beacon_id"])
            )
            if (
                str(beacon["status"]) == "assigned"
                and str(beacon["assigned_agent_id"]) == str(agent_id)
            ):
                return {
                    "ok": True,
                    "status": "assigned",
                    "idempotent": True,
                    "installation_task_id": str(task["id"]),
                    "request_id": str(task["request_id"]),
                    "beacon_id": str(task["beacon_id"]),
                    "public_number": str(beacon["public_number"]),
                    "agent_id": str(agent_id),
                    "source_type": str(task["source_type"]),
                }

        raise PhysicalWorkflowStateError(
            "Cette tâche générique est déjà affectée différemment."
        )

    _assert_task_shape_for_initial_assignment(task)

    beacon = _load_stock_beacon_for_update(
        beacon_id=stock_beacon_id
    )
    _require_compatible_available_stock(
        task=task,
        beacon=beacon,
    )

    source_type = str(task["source_type"])
    legacy_result = None

    if source_type == "customer_order":
        legacy = _legacy_customer_order_pending(task=task)
        if str(legacy["status"]) != "pending":
            raise PhysicalWorkflowStateError(
                "Le bridge H2 customer_order n est plus pending."
            )

        legacy_result = assign_physical_installation(
            pending_installation_id=str(legacy["id"]),
            actor_id=actor_id,
            agent_id=agent_id,
            stock_beacon_id=stock_beacon_id,
        )
        effective_beacon_id = str(
            legacy_result["beacon_id"]
        )
    else:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE public.beacons
                SET
                    status = 'assigned',
                    assigned_agent_id = %s
                WHERE id = %s
                  AND numbering_version = 'v1'
                  AND status = 'available'
                  AND assigned_agent_id IS NULL
                  AND lot_id IS NOT NULL
                  AND category = %s
                  AND commune_code_at_issue = %s
                """,
                [
                    agent_id,
                    stock_beacon_id,
                    task["category"],
                    task["commune_code"],
                ],
            )
            if cursor.rowcount != 1:
                raise PhysicalWorkflowStateError(
                    "La réservation du stock générique a été modifiée concurremment."
                )

        effective_beacon_id = str(stock_beacon_id)

    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE public.installation_tasks
            SET
                beacon_id = %s,
                assigned_agent_id = %s,
                status = 'assigned',
                updated_at = NOW()
            WHERE id = %s
              AND status = 'pending'
              AND beacon_id IS NULL
              AND assigned_agent_id IS NULL
              AND scheduled_at IS NULL
              AND installation_id IS NULL
              AND installed_at IS NULL
              AND completed_at IS NULL
            """,
            [
                effective_beacon_id,
                agent_id,
                task["id"],
            ],
        )
        if cursor.rowcount != 1:
            raise PhysicalWorkflowStateError(
                "L affectation de la tâche générique a été modifiée concurremment."
            )

    _set_request_in_progress(
        request_id=str(task["request_id"])
    )

    _insert_audit(
        actor_id=actor_id,
        action="installation_task.assign.supervisor.v1",
        task_id=str(task["id"]),
        before={
            "status": "pending",
            "beacon_id": None,
            "assigned_agent_id": None,
            "request_status": str(task["request_status"]),
        },
        after={
            "status": "assigned",
            "beacon_id": effective_beacon_id,
            "assigned_agent_id": str(agent_id),
            "request_status": "in_progress",
            "source_type": source_type,
            "legacy_h2_bridge": (
                source_type == "customer_order"
            ),
        },
    )

    return {
        "ok": True,
        "status": "assigned",
        "idempotent": False,
        "installation_task_id": str(task["id"]),
        "request_id": str(task["request_id"]),
        "request_reference": str(task["reference"]),
        "beacon_id": effective_beacon_id,
        "public_number": str(beacon["public_number"]),
        "agent_id": str(agent_id),
        "source_type": source_type,
        "legacy_h2_bridge": (
            legacy_result is not None
        ),
    }


@transaction.atomic
def reassign_generic_installation_task(
    *,
    installation_task_id: str,
    actor_id: str,
    agent_id: str,
) -> dict[str, Any]:
    task = _load_task_for_update(
        installation_task_id=installation_task_id
    )
    if task is None:
        raise PhysicalWorkflowNotFoundError(
            "Tâche générique à réaffecter introuvable."
        )

    _require_dispatchable_request(task)

    if str(task["status"]) not in {
        "assigned",
        "planned",
    }:
        raise PhysicalWorkflowStateError(
            "Seule une tâche affectée ou planifiée peut être réaffectée."
        )
    if (
        task["beacon_id"] is None
        or task["assigned_agent_id"] is None
        or task["installation_id"] is not None
        or task["installed_at"] is not None
        or task["completed_at"] is not None
    ):
        raise PhysicalWorkflowStateError(
            "Etat générique incohérent pour une réaffectation."
        )

    previous_agent_id = str(task["assigned_agent_id"])
    beacon = _load_stock_beacon_for_update(
        beacon_id=str(task["beacon_id"])
    )

    if (
        str(beacon["status"]) != "assigned"
        or str(beacon["assigned_agent_id"]) != previous_agent_id
    ):
        raise PhysicalWorkflowStateError(
            "Etat balise/tâche incohérent avant réaffectation."
        )

    if previous_agent_id == str(agent_id):
        return {
            "ok": True,
            "status": str(task["status"]),
            "idempotent": True,
            "installation_task_id": str(task["id"]),
            "request_id": str(task["request_id"]),
            "beacon_id": str(task["beacon_id"]),
            "public_number": str(beacon["public_number"]),
            "previous_agent_id": previous_agent_id,
            "agent_id": str(agent_id),
            "scheduled_at": (
                task["scheduled_at"].isoformat()
                if task["scheduled_at"] is not None
                else None
            ),
        }

    _require_active_agent(agent_id=agent_id)

    if str(task["source_type"]) == "customer_order":
        legacy = _legacy_customer_order_pending(task=task)
        reassign_physical_installation(
            pending_installation_id=str(legacy["id"]),
            actor_id=actor_id,
            agent_id=agent_id,
        )
    else:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE public.beacons
                SET assigned_agent_id = %s
                WHERE id = %s
                  AND numbering_version = 'v1'
                  AND status = 'assigned'
                  AND assigned_agent_id = %s
                """,
                [
                    agent_id,
                    task["beacon_id"],
                    previous_agent_id,
                ],
            )
            if cursor.rowcount != 1:
                raise PhysicalWorkflowStateError(
                    "La réaffectation du stock générique a été modifiée concurremment."
                )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE public.installation_tasks
            SET
                assigned_agent_id = %s,
                updated_at = NOW()
            WHERE id = %s
              AND status IN ('assigned', 'planned')
              AND beacon_id = %s
              AND assigned_agent_id = %s
              AND installation_id IS NULL
              AND installed_at IS NULL
              AND completed_at IS NULL
            """,
            [
                agent_id,
                task["id"],
                task["beacon_id"],
                previous_agent_id,
            ],
        )
        if cursor.rowcount != 1:
            raise PhysicalWorkflowStateError(
                "La réaffectation de la tâche générique a été modifiée concurremment."
            )

    _insert_audit(
        actor_id=actor_id,
        action="installation_task.reassign.supervisor.v1",
        task_id=str(task["id"]),
        before={
            "status": str(task["status"]),
            "beacon_id": str(task["beacon_id"]),
            "assigned_agent_id": previous_agent_id,
        },
        after={
            "status": str(task["status"]),
            "beacon_id": str(task["beacon_id"]),
            "assigned_agent_id": str(agent_id),
        },
    )

    return {
        "ok": True,
        "status": str(task["status"]),
        "idempotent": False,
        "installation_task_id": str(task["id"]),
        "request_id": str(task["request_id"]),
        "beacon_id": str(task["beacon_id"]),
        "public_number": str(beacon["public_number"]),
        "previous_agent_id": previous_agent_id,
        "agent_id": str(agent_id),
        "scheduled_at": (
            task["scheduled_at"].isoformat()
            if task["scheduled_at"] is not None
            else None
        ),
    }


@transaction.atomic
def schedule_generic_installation_task(
    *,
    installation_task_id: str,
    actor_id: str,
    scheduled_at: datetime,
) -> dict[str, Any]:
    if scheduled_at is None:
        raise PhysicalWorkflowStateError(
            "La date de planification est obligatoire."
        )

    task = _load_task_for_update(
        installation_task_id=installation_task_id
    )
    if task is None:
        raise PhysicalWorkflowNotFoundError(
            "Tâche générique à planifier introuvable."
        )

    _require_dispatchable_request(task)

    if str(task["status"]) not in {
        "assigned",
        "planned",
    }:
        raise PhysicalWorkflowStateError(
            "La tâche générique doit être affectée avant planification."
        )
    if (
        task["beacon_id"] is None
        or task["assigned_agent_id"] is None
        or task["installation_id"] is not None
        or task["installed_at"] is not None
        or task["completed_at"] is not None
    ):
        raise PhysicalWorkflowStateError(
            "Etat générique incohérent pour la planification."
        )

    _require_active_agent(
        agent_id=str(task["assigned_agent_id"])
    )

    beacon = _load_stock_beacon_for_update(
        beacon_id=str(task["beacon_id"])
    )
    if (
        str(beacon["status"]) != "assigned"
        or str(beacon["assigned_agent_id"])
        != str(task["assigned_agent_id"])
    ):
        raise PhysicalWorkflowStateError(
            "Etat balise/tâche incohérent avant planification."
        )

    if (
        str(task["status"]) == "planned"
        and task["scheduled_at"] is not None
        and task["scheduled_at"] == scheduled_at
    ):
        return {
            "ok": True,
            "status": "planned",
            "idempotent": True,
            "installation_task_id": str(task["id"]),
            "request_id": str(task["request_id"]),
            "beacon_id": str(task["beacon_id"]),
            "public_number": str(beacon["public_number"]),
            "agent_id": str(task["assigned_agent_id"]),
            "scheduled_at": task["scheduled_at"].isoformat(),
        }

    if str(task["source_type"]) == "customer_order":
        legacy = _legacy_customer_order_pending(task=task)
        schedule_physical_installation(
            pending_installation_id=str(legacy["id"]),
            actor_id=actor_id,
            scheduled_at=scheduled_at,
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE public.installation_tasks
            SET
                scheduled_at = %s,
                status = 'planned',
                updated_at = NOW()
            WHERE id = %s
              AND status IN ('assigned', 'planned')
              AND beacon_id = %s
              AND assigned_agent_id = %s
              AND installation_id IS NULL
              AND installed_at IS NULL
              AND completed_at IS NULL
            """,
            [
                scheduled_at,
                task["id"],
                task["beacon_id"],
                task["assigned_agent_id"],
            ],
        )
        if cursor.rowcount != 1:
            raise PhysicalWorkflowStateError(
                "La planification générique a été modifiée concurremment."
            )

    _set_request_in_progress(
        request_id=str(task["request_id"])
    )

    _insert_audit(
        actor_id=actor_id,
        action="installation_task.schedule.supervisor.v1",
        task_id=str(task["id"]),
        before={
            "status": str(task["status"]),
            "scheduled_at": (
                task["scheduled_at"].isoformat()
                if task["scheduled_at"] is not None
                else None
            ),
        },
        after={
            "status": "planned",
            "scheduled_at": scheduled_at.isoformat(),
            "beacon_id": str(task["beacon_id"]),
            "assigned_agent_id": str(task["assigned_agent_id"]),
        },
    )

    return {
        "ok": True,
        "status": "planned",
        "idempotent": False,
        "installation_task_id": str(task["id"]),
        "request_id": str(task["request_id"]),
        "beacon_id": str(task["beacon_id"]),
        "public_number": str(beacon["public_number"]),
        "agent_id": str(task["assigned_agent_id"]),
        "scheduled_at": scheduled_at.isoformat(),
    }
