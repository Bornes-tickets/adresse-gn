from __future__ import annotations

from datetime import datetime
from typing import Any

from django.db import connection, transaction

from entitlements import (
    installation_requirements_from_order_items,
)


class PhysicalWorkflowError(RuntimeError):
    code = "PHYSICAL_WORKFLOW_ERROR"


class PhysicalWorkflowNotFoundError(PhysicalWorkflowError):
    code = "PHYSICAL_WORKFLOW_NOT_FOUND"


class PhysicalWorkflowStateError(PhysicalWorkflowError):
    code = "PHYSICAL_WORKFLOW_STATE_INVALID"



def _require_physical_purchase_snapshot(
    *,
    items,
) -> dict:
    requirements = (
        installation_requirements_from_order_items(
            items
        )
    )

    if requirements is None:
        raise PhysicalWorkflowStateError(
            "Le snapshot achet? ne contient pas un contrat "
            "d'installation physique V1 valide."
        )

    if (
        str(
            requirements.get(
                "fulfillment_kind"
            )
            or ""
        )
        != "physical_installation"
    ):
        raise PhysicalWorkflowStateError(
            "Le snapshot achet? ne correspond pas "
            "? une installation physique."
        )

    return requirements



def _load_pending_for_update(*, pending_installation_id: str):
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                pi.id,
                pi.order_id,
                pi.status,
                pi.beacon_id,
                pi.assigned_agent_id,
                pi.scheduled_at,
                pi.completed_at,
                o.status AS order_status,
                o.beacon_id AS order_beacon_id,
                o.items
            FROM public.pending_installations pi
            JOIN public.orders o
              ON o.id = pi.order_id
            WHERE pi.id = %s
            FOR UPDATE OF pi, o
            """,
            [pending_installation_id],
        )
        row = cursor.fetchone()

    if row is None:
        return None

    requirements = (
        _require_physical_purchase_snapshot(
            items=row[-1],
        )
    )

    return (
        *row[:-1],
        requirements[
            "fulfillment_kind"
        ],
    )


def _require_active_agent(*, agent_id: str) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                ag.active,
                (au.id IS NOT NULL) AS auth_user_exists
            FROM public.agents ag
            LEFT JOIN auth.users au
              ON au.id = ag.id
            WHERE ag.id = %s
            FOR UPDATE OF ag
            """,
            [agent_id],
        )
        row = cursor.fetchone()

    if row is None:
        raise PhysicalWorkflowNotFoundError("Agent introuvable.")

    if row[0] is not True:
        raise PhysicalWorkflowStateError("Agent inactif.")

    if row[1] is not True:
        raise PhysicalWorkflowStateError(
            "Agent sans identite auth.users valide."
        )


def _canonical_beacon_id(
    *,
    pending_beacon_id,
    order_beacon_id,
) -> str:
    if pending_beacon_id is None or order_beacon_id is None:
        raise PhysicalWorkflowStateError(
            "La pre-allocation V1 physique est absente."
        )

    if str(pending_beacon_id) != str(order_beacon_id):
        raise PhysicalWorkflowStateError(
            "Les liens de balise pre-allouee sont incoherents."
        )

    return str(pending_beacon_id)


def _load_v1_preallocated_beacon_for_update(
    *,
    beacon_id: str,
):
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                public_number,
                status,
                numbering_version,
                assigned_agent_id
            FROM public.beacons
            WHERE id = %s
            FOR UPDATE
            """,
            [beacon_id],
        )
        row = cursor.fetchone()

    if row is None:
        raise PhysicalWorkflowNotFoundError(
            "Balise pre-allouee introuvable."
        )

    if str(row[3]) != "v1":
        raise PhysicalWorkflowStateError(
            "Seule une balise V1 peut etre affectee."
        )

    return row

def _ensure_physical_paid_order(
    *,
    order_status: str,
    fulfillment_kind: str,
) -> None:
    if str(order_status) != "paid":
        raise PhysicalWorkflowStateError(
            "La commande doit etre payee avant le workflow d'installation."
        )

    if str(fulfillment_kind) != "physical_installation":
        raise PhysicalWorkflowStateError(
            "Cette commande ne releve pas d'une installation physique."
        )



def _insert_audit(
    *,
    actor_id: str,
    action: str,
    entity_id: str,
    after: dict[str, Any],
    before: dict[str, Any] | None = None,
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
                'pending_installations',
                %s,
                %s::jsonb,
                %s::jsonb
            )
            """,
            [
                actor_id,
                action,
                entity_id,
                (
                    __import__("json").dumps(before)
                    if before is not None
                    else None
                ),
                __import__("json").dumps(after),
            ],
        )


def _rebind_placeholder_to_received_stock(
    *,
    pending_id: str,
    order_id: str,
    current_beacon_id: str,
    stock_beacon_id: str,
) -> dict[str, Any]:
    if str(current_beacon_id) == str(stock_beacon_id):
        return {
            "beacon_id": str(current_beacon_id),
            "public_number": None,
            "lot_code": None,
            "replaced_beacon_id": None,
        }

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                public_number,
                status,
                numbering_version,
                assigned_agent_id,
                category,
                commune_code_at_issue,
                lot_id
            FROM public.beacons
            WHERE id = %s
            FOR UPDATE
            """,
            [current_beacon_id],
        )
        current = cursor.fetchone()

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
                b.lot_id,
                l.code
            FROM public.beacons b
            JOIN public.lots l
              ON l.id = b.lot_id
            WHERE b.id = %s
            FOR UPDATE OF b, l
            """,
            [stock_beacon_id],
        )
        stock = cursor.fetchone()

    if current is None:
        raise PhysicalWorkflowNotFoundError(
            "Balise pré-allouée actuelle introuvable."
        )

    if stock is None:
        raise PhysicalWorkflowNotFoundError(
            "Balise reçue disponible introuvable."
        )

    (
        _,
        _current_public_number,
        current_status,
        current_version,
        current_agent_id,
        current_category,
        current_commune,
        current_lot_id,
    ) = current

    (
        _,
        stock_public_number,
        stock_status,
        stock_version,
        stock_agent_id,
        stock_category,
        stock_commune,
        stock_lot_id,
        stock_lot_code,
    ) = stock

    if str(current_version) != "v1":
        raise PhysicalWorkflowStateError(
            "La pré-allocation actuelle n’est pas en codification V1."
        )

    if str(current_status) != "available":
        raise PhysicalWorkflowStateError(
            "La pré-allocation actuelle doit encore être disponible."
        )

    if current_agent_id is not None:
        raise PhysicalWorkflowStateError(
            "La pré-allocation actuelle est déjà affectée à un agent."
        )

    if current_lot_id is not None:
        raise PhysicalWorkflowStateError(
            "Une balise physique de stock est déjà liée à cette demande."
        )

    if str(stock_version) != "v1":
        raise PhysicalWorkflowStateError(
            "Seule une balise reçue V1 peut être affectée."
        )

    if str(stock_status) != "available":
        raise PhysicalWorkflowStateError(
            "La balise reçue sélectionnée n’est plus disponible."
        )

    if stock_agent_id is not None:
        raise PhysicalWorkflowStateError(
            "La balise reçue sélectionnée est déjà affectée."
        )

    if stock_lot_id is None:
        raise PhysicalWorkflowStateError(
            "La balise sélectionnée ne provient pas d’un lot OPS."
        )

    if str(stock_category) == "digital_only":
        raise PhysicalWorkflowStateError(
            "Une balise numérique seule ne peut pas être affectée au terrain."
        )

    if str(stock_category) != str(current_category):
        raise PhysicalWorkflowStateError(
            "La catégorie de la balise reçue ne correspond pas à la commande."
        )

    if str(stock_commune) != str(current_commune):
        raise PhysicalWorkflowStateError(
            "La commune de la balise reçue ne correspond pas à la commande."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id
            FROM public.addresses
            WHERE beacon_id = %s
            FOR UPDATE
            """,
            [current_beacon_id],
        )
        address_rows = cursor.fetchall()

        if len(address_rows) != 1:
            raise PhysicalWorkflowStateError(
                "La pré-allocation doit posséder une adresse canonique unique."
            )

        address_id = address_rows[0][0]

        cursor.execute(
            """
            SELECT 1
            FROM public.addresses
            WHERE beacon_id = %s
            LIMIT 1
            """,
            [stock_beacon_id],
        )
        if cursor.fetchone() is not None:
            raise PhysicalWorkflowStateError(
                "La balise reçue sélectionnée est déjà liée à une adresse."
            )

        cursor.execute(
            """
            UPDATE public.addresses
            SET beacon_id = %s
            WHERE id = %s
              AND beacon_id = %s
            """,
            [stock_beacon_id, address_id, current_beacon_id],
        )
        if cursor.rowcount != 1:
            raise PhysicalWorkflowStateError(
                "Le rattachement de l’adresse a été modifié concurremment."
            )

        cursor.execute(
            """
            UPDATE public.orders
            SET beacon_id = %s
            WHERE id = %s
              AND beacon_id = %s
            """,
            [stock_beacon_id, order_id, current_beacon_id],
        )
        if cursor.rowcount != 1:
            raise PhysicalWorkflowStateError(
                "Le rattachement de la commande a été modifié concurremment."
            )

        cursor.execute(
            """
            UPDATE public.order_sites
            SET beacon_id = %s
            WHERE order_id = %s
              AND beacon_id = %s
            """,
            [stock_beacon_id, order_id, current_beacon_id],
        )
        if cursor.rowcount != 1:
            raise PhysicalWorkflowStateError(
                "Le rattachement du site a été modifié concurremment."
            )

        cursor.execute(
            """
            UPDATE public.pending_installations
            SET
                beacon_id = %s,
                updated_at = NOW()
            WHERE id = %s
              AND beacon_id = %s
              AND status = 'pending'
              AND assigned_agent_id IS NULL
              AND scheduled_at IS NULL
              AND completed_at IS NULL
            """,
            [stock_beacon_id, pending_id, current_beacon_id],
        )
        if cursor.rowcount != 1:
            raise PhysicalWorkflowStateError(
                "Le rattachement de la demande a été modifié concurremment."
            )

        cursor.execute(
            """
            UPDATE public.beacons
            SET status = 'cancelled'
            WHERE id = %s
              AND numbering_version = 'v1'
              AND lot_id IS NULL
              AND status = 'available'
              AND assigned_agent_id IS NULL
            """,
            [current_beacon_id],
        )
        if cursor.rowcount != 1:
            raise PhysicalWorkflowStateError(
                "L’ancienne pré-allocation n’a pas pu être neutralisée."
            )

    return {
        "beacon_id": str(stock_beacon_id),
        "public_number": str(stock_public_number),
        "lot_code": str(stock_lot_code),
        "replaced_beacon_id": str(current_beacon_id),
    }


@transaction.atomic
def assign_physical_installation(
    *,
    pending_installation_id: str,
    actor_id: str,
    agent_id: str,
    stock_beacon_id: str | None = None,
) -> dict[str, Any]:
    row = _load_pending_for_update(
        pending_installation_id=pending_installation_id
    )

    if row is None:
        raise PhysicalWorkflowNotFoundError(
            "Installation a affecter introuvable."
        )

    (
        pending_id,
        order_id,
        current_status,
        pending_beacon_id,
        assigned_agent_id,
        scheduled_at,
        completed_at,
        order_status,
        order_beacon_id,
        fulfillment_kind,
    ) = row

    _ensure_physical_paid_order(
        order_status=str(order_status),
        fulfillment_kind=str(fulfillment_kind),
    )

    if str(current_status) not in {"pending", "assigned"}:
        raise PhysicalWorkflowStateError(
            "Seule une installation en attente peut etre affectee."
        )

    if scheduled_at is not None or completed_at is not None:
        raise PhysicalWorkflowStateError(
            "Etat incoherent: dates operationnelles deja renseignees."
        )

    beacon_id = _canonical_beacon_id(
        pending_beacon_id=pending_beacon_id,
        order_beacon_id=order_beacon_id,
    )

    original_beacon_id = str(beacon_id)
    selected_stock_beacon_id = str(
        stock_beacon_id
        or beacon_id
    )

    binding = None

    if selected_stock_beacon_id != original_beacon_id:
        binding = _rebind_placeholder_to_received_stock(
            pending_id=str(pending_id),
            order_id=str(order_id),
            current_beacon_id=original_beacon_id,
            stock_beacon_id=selected_stock_beacon_id,
        )
        beacon_id = binding["beacon_id"]

    _require_active_agent(agent_id=agent_id)

    beacon_row = _load_v1_preallocated_beacon_for_update(
        beacon_id=beacon_id
    )
    (
        _,
        public_number,
        beacon_status,
        _,
        beacon_agent_id,
    ) = beacon_row

    if str(current_status) == "assigned":
        if (
            str(beacon_status) == "assigned"
            and str(assigned_agent_id) == str(agent_id)
            and str(beacon_agent_id) == str(agent_id)
        ):
            return {
                "ok": True,
                "status": "assigned",
                "idempotent": True,
                "pending_installation_id": str(pending_id),
                "order_id": str(order_id),
                "beacon_id": beacon_id,
                "public_number": str(public_number),
                "agent_id": str(agent_id),
            }

        raise PhysicalWorkflowStateError(
            "Cette installation est deja affectee ou son lien agent/balise "
            "est incoherent."
        )

    if assigned_agent_id is not None:
        raise PhysicalWorkflowStateError(
            "Etat incoherent: la demande pending a deja un agent."
        )

    if str(beacon_status) != "available":
        raise PhysicalWorkflowStateError(
            "La balise V1 pre-allouee doit etre disponible avant affectation."
        )

    if beacon_agent_id is not None:
        raise PhysicalWorkflowStateError(
            "La balise V1 pre-allouee est deja affectee a un agent."
        )

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
            """,
            [agent_id, beacon_id],
        )
        if cursor.rowcount != 1:
            raise PhysicalWorkflowStateError(
                "La reservation de la balise a ete modifiee concurremment."
            )

        cursor.execute(
            """
            UPDATE public.pending_installations
            SET
                assigned_agent_id = %s,
                status = 'assigned',
                updated_at = NOW()
            WHERE id = %s
              AND beacon_id = %s
              AND status = 'pending'
              AND assigned_agent_id IS NULL
              AND scheduled_at IS NULL
              AND completed_at IS NULL
            """,
            [agent_id, pending_id, beacon_id],
        )
        if cursor.rowcount != 1:
            raise PhysicalWorkflowStateError(
                "L'affectation a ete modifiee concurremment."
            )

    _insert_audit(
        actor_id=actor_id,
        action="installation.assign.v1",
        entity_id=str(pending_id),
        before={
            "order_id": str(order_id),
            "beacon_id": beacon_id,
            "public_number": str(public_number),
            "request_status": "pending",
            "request_agent_id": None,
            "beacon_status": "available",
            "beacon_agent_id": None,
        },
        after={
            "order_id": str(order_id),
            "beacon_id": beacon_id,
            "public_number": str(public_number),
            "request_status": "assigned",
            "request_agent_id": str(agent_id),
            "beacon_status": "assigned",
            "beacon_agent_id": str(agent_id),
            "replaced_beacon_id": (
                binding["replaced_beacon_id"]
                if binding
                else None
            ),
        },
    )

    return {
        "ok": True,
        "status": "assigned",
        "idempotent": False,
        "pending_installation_id": str(pending_id),
        "order_id": str(order_id),
        "beacon_id": beacon_id,
        "public_number": str(public_number),
        "agent_id": str(agent_id),
    }


@transaction.atomic
def reassign_physical_installation(
    *,
    pending_installation_id: str,
    actor_id: str,
    agent_id: str,
) -> dict[str, Any]:
    row = _load_pending_for_update(
        pending_installation_id=pending_installation_id
    )

    if row is None:
        raise PhysicalWorkflowNotFoundError(
            "Installation a reaffecter introuvable."
        )

    (
        pending_id,
        order_id,
        current_status,
        pending_beacon_id,
        assigned_agent_id,
        scheduled_at,
        completed_at,
        order_status,
        order_beacon_id,
        fulfillment_kind,
    ) = row

    _ensure_physical_paid_order(
        order_status=str(order_status),
        fulfillment_kind=str(fulfillment_kind),
    )

    if str(current_status) not in {
        "assigned",
        "planned",
    }:
        raise PhysicalWorkflowStateError(
            "Seule une installation affectee ou planifiee "
            "peut etre reaffectee."
        )

    if completed_at is not None:
        raise PhysicalWorkflowStateError(
            "Une installation terminee ne peut plus etre reaffectee."
        )

    if assigned_agent_id is None:
        raise PhysicalWorkflowStateError(
            "Aucun agent initial n est affecte. "
            "Utilisez l affectation initiale."
        )

    if (
        str(current_status) == "assigned"
        and scheduled_at is not None
    ):
        raise PhysicalWorkflowStateError(
            "Etat incoherent: une installation affectee "
            "ne doit pas deja etre planifiee."
        )

    if (
        str(current_status) == "planned"
        and scheduled_at is None
    ):
        raise PhysicalWorkflowStateError(
            "Etat incoherent: une installation planifiee "
            "doit avoir une date."
        )

    beacon_id = _canonical_beacon_id(
        pending_beacon_id=pending_beacon_id,
        order_beacon_id=order_beacon_id,
    )

    _require_active_agent(agent_id=agent_id)

    beacon_row = _load_v1_preallocated_beacon_for_update(
        beacon_id=beacon_id
    )
    (
        _,
        public_number,
        beacon_status,
        _,
        beacon_agent_id,
    ) = beacon_row

    if str(beacon_status) != "assigned":
        raise PhysicalWorkflowStateError(
            "Etat incoherent: la balise doit etre affectee avant reaffectation."
        )

    if beacon_agent_id is None:
        raise PhysicalWorkflowStateError(
            "Etat incoherent: la balise n a aucun agent affecte."
        )

    if str(beacon_agent_id) != str(assigned_agent_id):
        raise PhysicalWorkflowStateError(
            "Etat incoherent: les agents demande/balise divergent."
        )

    if str(assigned_agent_id) == str(agent_id):
        return {
            "ok": True,
            "status": str(current_status),
            "idempotent": True,
            "pending_installation_id": str(pending_id),
            "order_id": str(order_id),
            "beacon_id": beacon_id,
            "public_number": str(public_number),
            "previous_agent_id": str(assigned_agent_id),
            "agent_id": str(agent_id),
            "scheduled_at": (
                scheduled_at.isoformat()
                if scheduled_at is not None
                else None
            ),
        }

    previous_agent_id = str(assigned_agent_id)

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
                beacon_id,
                previous_agent_id,
            ],
        )

        if cursor.rowcount != 1:
            raise PhysicalWorkflowStateError(
                "La reaffectation de la balise a ete modifiee concurremment."
            )

        cursor.execute(
            """
            UPDATE public.pending_installations
            SET
                assigned_agent_id = %s,
                updated_at = NOW()
            WHERE id = %s
              AND beacon_id = %s
              AND status IN ('assigned', 'planned')
              AND assigned_agent_id = %s
              AND completed_at IS NULL
            """,
            [
                agent_id,
                pending_id,
                beacon_id,
                previous_agent_id,
            ],
        )

        if cursor.rowcount != 1:
            raise PhysicalWorkflowStateError(
                "La reaffectation a ete modifiee concurremment."
            )

    _insert_audit(
        actor_id=actor_id,
        action="installation.reassign.v1",
        entity_id=str(pending_id),
        before={
            "order_id": str(order_id),
            "beacon_id": beacon_id,
            "public_number": str(public_number),
            "request_status": str(current_status),
            "request_agent_id": previous_agent_id,
            "beacon_status": str(beacon_status),
            "beacon_agent_id": previous_agent_id,
            "scheduled_at": (
                scheduled_at.isoformat()
                if scheduled_at is not None
                else None
            ),
        },
        after={
            "order_id": str(order_id),
            "beacon_id": beacon_id,
            "public_number": str(public_number),
            "request_status": str(current_status),
            "request_agent_id": str(agent_id),
            "beacon_status": str(beacon_status),
            "beacon_agent_id": str(agent_id),
            "scheduled_at": (
                scheduled_at.isoformat()
                if scheduled_at is not None
                else None
            ),
        },
    )

    return {
        "ok": True,
        "status": str(current_status),
        "idempotent": False,
        "pending_installation_id": str(pending_id),
        "order_id": str(order_id),
        "beacon_id": beacon_id,
        "public_number": str(public_number),
        "previous_agent_id": previous_agent_id,
        "agent_id": str(agent_id),
        "scheduled_at": (
            scheduled_at.isoformat()
            if scheduled_at is not None
            else None
        ),
    }


@transaction.atomic
def schedule_physical_installation(
    *,
    pending_installation_id: str,
    actor_id: str,
    scheduled_at: datetime,
) -> dict[str, Any]:
    if scheduled_at is None:
        raise PhysicalWorkflowStateError(
            "La date de planification est obligatoire."
        )

    row = _load_pending_for_update(
        pending_installation_id=pending_installation_id
    )

    if row is None:
        raise PhysicalWorkflowNotFoundError(
            "Installation a planifier introuvable."
        )

    (
        pending_id,
        order_id,
        current_status,
        pending_beacon_id,
        assigned_agent_id,
        current_scheduled_at,
        completed_at,
        order_status,
        order_beacon_id,
        fulfillment_kind,
    ) = row

    _ensure_physical_paid_order(
        order_status=str(order_status),
        fulfillment_kind=str(fulfillment_kind),
    )

    if str(current_status) not in {"assigned", "planned"}:
        raise PhysicalWorkflowStateError(
            "L'installation doit etre affectee avant sa planification."
        )

    if assigned_agent_id is None:
        raise PhysicalWorkflowStateError(
            "Un agent doit etre affecte avant la planification."
        )

    if completed_at is not None:
        raise PhysicalWorkflowStateError(
            "Une installation terminee ne peut plus etre planifiee."
        )

    beacon_id = _canonical_beacon_id(
        pending_beacon_id=pending_beacon_id,
        order_beacon_id=order_beacon_id,
    )

    _require_active_agent(
        agent_id=str(assigned_agent_id)
    )

    beacon_row = _load_v1_preallocated_beacon_for_update(
        beacon_id=beacon_id
    )
    (
        _,
        public_number,
        beacon_status,
        _,
        beacon_agent_id,
    ) = beacon_row

    if str(beacon_status) != "assigned":
        raise PhysicalWorkflowStateError(
            "La balise V1 doit etre affectee avant la planification."
        )

    if beacon_agent_id is None:
        raise PhysicalWorkflowStateError(
            "La balise V1 doit etre affectee avant la planification."
        )

    if str(beacon_agent_id) != str(assigned_agent_id):
        raise PhysicalWorkflowStateError(
            "Etat incoherent: les agents demande/balise divergent."
        )

    if (
        str(current_status) == "planned"
        and current_scheduled_at is not None
        and current_scheduled_at == scheduled_at
    ):
        return {
            "ok": True,
            "status": "planned",
            "idempotent": True,
            "pending_installation_id": str(pending_id),
            "order_id": str(order_id),
            "beacon_id": beacon_id,
            "public_number": str(public_number),
            "agent_id": str(assigned_agent_id),
            "scheduled_at": current_scheduled_at.isoformat(),
        }

    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE public.pending_installations
            SET
                scheduled_at = %s,
                status = 'planned',
                updated_at = NOW()
            WHERE id = %s
              AND beacon_id = %s
              AND status IN ('assigned', 'planned')
              AND assigned_agent_id = %s
              AND completed_at IS NULL
            """,
            [
                scheduled_at,
                pending_id,
                beacon_id,
                assigned_agent_id,
            ],
        )
        if cursor.rowcount != 1:
            raise PhysicalWorkflowStateError(
                "La planification a ete modifiee concurremment."
            )

    _insert_audit(
        actor_id=actor_id,
        action="installation.schedule.v1",
        entity_id=str(pending_id),
        before={
            "order_id": str(order_id),
            "beacon_id": beacon_id,
            "public_number": str(public_number),
            "status": str(current_status),
            "agent_id": str(assigned_agent_id),
            "beacon_status": str(beacon_status),
            "scheduled_at": (
                current_scheduled_at.isoformat()
                if current_scheduled_at is not None
                else None
            ),
        },
        after={
            "order_id": str(order_id),
            "beacon_id": beacon_id,
            "public_number": str(public_number),
            "status": "planned",
            "agent_id": str(assigned_agent_id),
            "beacon_status": str(beacon_status),
            "scheduled_at": scheduled_at.isoformat(),
        },
    )

    return {
        "ok": True,
        "status": "planned",
        "idempotent": False,
        "pending_installation_id": str(pending_id),
        "order_id": str(order_id),
        "beacon_id": beacon_id,
        "public_number": str(public_number),
        "agent_id": str(assigned_agent_id),
        "scheduled_at": scheduled_at.isoformat(),
    }

def _load_validation_targets(
    *,
    pending_installation_id: str,
) -> tuple:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                pi.id,
                pi.order_id,
                pi.status,
                pi.beacon_id,
                pi.completed_at,
                o.status AS order_status,
                o.items
            FROM public.pending_installations pi
            JOIN public.orders o
              ON o.id = pi.order_id
            WHERE pi.id = %s
            FOR UPDATE OF pi, o
            """,
            [pending_installation_id],
        )
        pending_row = cursor.fetchone()

    if pending_row is None:
        raise PhysicalWorkflowNotFoundError(
            "Installation a valider introuvable."
        )

    (
        pending_id,
        order_id,
        pending_status,
        beacon_id,
        completed_at,
        order_status,
        order_items,
    ) = pending_row

    requirements = (
        _require_physical_purchase_snapshot(
            items=order_items,
        )
    )

    fulfillment_kind = (
        requirements[
            "fulfillment_kind"
        ]
    )

    _ensure_physical_paid_order(
        order_status=str(order_status),
        fulfillment_kind=str(fulfillment_kind),
    )

    if beacon_id is None:
        raise PhysicalWorkflowStateError(
            "Aucune balise n est rattachee a cette intervention."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id
            FROM public.order_sites
            WHERE order_id = %s
            ORDER BY sequence_no
            FOR UPDATE
            """,
            [order_id],
        )
        site_rows = cursor.fetchall()

    if len(site_rows) != 1:
        raise PhysicalWorkflowStateError(
            "La commande physique doit avoir exactement un site canonique."
        )

    order_site_id = site_rows[0][0]

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                validated_at,
                validator_id
            FROM public.installations
            WHERE order_site_id = %s
              AND beacon_id = %s
              AND uninstalled_at IS NULL
            ORDER BY installed_at DESC NULLS LAST, id
            FOR UPDATE
            """,
            [order_site_id, beacon_id],
        )
        installation_rows = cursor.fetchall()

    if len(installation_rows) != 1:
        raise PhysicalWorkflowStateError(
            "Une installation terrain active unique est requise avant validation."
        )

    installation_id, validated_at, validator_id = installation_rows[0]

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                a.id,
                a.verification_level,
                a.visibility,
                a.status,
                b.status AS beacon_status,
                b.numbering_version,
                b.activated_at
            FROM public.addresses a
            JOIN public.beacons b
              ON b.id = a.beacon_id
            WHERE a.beacon_id = %s
            FOR UPDATE OF a, b
            """,
            [beacon_id],
        )
        address_rows = cursor.fetchall()

    if len(address_rows) != 1:
        raise PhysicalWorkflowStateError(
            "Une adresse canonique unique est requise avant validation."
        )

    (
        address_id,
        verification_level,
        visibility,
        address_status,
        beacon_status,
        beacon_numbering_version,
        beacon_activated_at,
    ) = address_rows[0]

    return (
        pending_id,
        order_id,
        pending_status,
        beacon_id,
        completed_at,
        order_site_id,
        installation_id,
        validated_at,
        validator_id,
        address_id,
        verification_level,
        visibility,
        address_status,
        beacon_status,
        beacon_numbering_version,
        beacon_activated_at,
    )


@transaction.atomic
def validate_physical_installation(
    *,
    pending_installation_id: str,
    actor_id: str,
) -> dict[str, Any]:
    (
        pending_id,
        order_id,
        pending_status,
        beacon_id,
        completed_at,
        order_site_id,
        installation_id,
        validated_at,
        validator_id,
        address_id,
        verification_level,
        visibility,
        address_status,
        beacon_status,
        beacon_numbering_version,
        beacon_activated_at,
    ) = _load_validation_targets(
        pending_installation_id=pending_installation_id
    )

    if str(pending_status) == "done":
        if (
            completed_at is None
            or validated_at is None
            or str(verification_level) != "verified"
            or str(beacon_numbering_version) != "v1"
            or str(beacon_status) != "active"
            or beacon_activated_at is None
        ):
            raise PhysicalWorkflowStateError(
                "Etat final incoherent pour cette installation."
            )

        return {
            "ok": True,
            "status": "done",
            "idempotent": True,
            "pending_installation_id": str(pending_id),
            "order_id": str(order_id),
            "beacon_id": str(beacon_id),
            "order_site_id": str(order_site_id),
            "installation_id": str(installation_id),
            "address_id": str(address_id),
            "visibility": str(visibility),
            "verification_level": str(verification_level),
        }

    if str(pending_status) != "installed":
        raise PhysicalWorkflowStateError(
            "L intervention terrain doit etre enregistree avant validation."
        )

    if completed_at is not None:
        raise PhysicalWorkflowStateError(
            "completed_at doit etre vide avant validation."
        )

    if validated_at is not None or validator_id is not None:
        raise PhysicalWorkflowStateError(
            "L installation terrain est deja marquee comme validee."
        )

    if str(beacon_numbering_version) != "v1":
        raise PhysicalWorkflowStateError(
            "La balise à valider doit utiliser la numérotation V1."
        )

    if str(beacon_status) != "installed":
        raise PhysicalWorkflowStateError(
            "La balise doit être installée avant validation."
        )

    if beacon_activated_at is not None:
        raise PhysicalWorkflowStateError(
            "activated_at doit être vide avant validation."
        )

    if str(address_status) != "active":
        raise PhysicalWorkflowStateError(
            "L adresse doit etre active avant validation."
        )

    if str(visibility) != "private":
        raise PhysicalWorkflowStateError(
            "La validation ne publie pas automatiquement l adresse."
        )

    if str(verification_level) not in {"pending", "unverified"}:
        raise PhysicalWorkflowStateError(
            "Niveau de verification incompatible avec la validation."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE public.beacons
            SET
                status = 'active',
                activated_at = NOW()
            WHERE id = %s
              AND numbering_version = 'v1'
              AND status = 'installed'
              AND activated_at IS NULL
            """,
            [beacon_id],
        )
        if cursor.rowcount != 1:
            raise PhysicalWorkflowStateError(
                "La balise a été modifiée concurremment."
            )

        cursor.execute(
            """
            UPDATE public.installations
            SET
                validated_at = NOW(),
                validator_id = %s
            WHERE id = %s
              AND validated_at IS NULL
              AND validator_id IS NULL
              AND uninstalled_at IS NULL
            """,
            [actor_id, installation_id],
        )
        if cursor.rowcount != 1:
            raise PhysicalWorkflowStateError(
                "L installation a ete modifiee concurremment."
            )

        cursor.execute(
            """
            UPDATE public.addresses
            SET verification_level = 'verified'
            WHERE id = %s
              AND status = 'active'
              AND visibility = 'private'
              AND verification_level IN ('pending', 'unverified')
            """,
            [address_id],
        )
        if cursor.rowcount != 1:
            raise PhysicalWorkflowStateError(
                "L adresse a ete modifiee concurremment."
            )

        cursor.execute(
            """
            UPDATE public.pending_installations
            SET
                status = 'done',
                completed_at = NOW(),
                updated_at = NOW()
            WHERE id = %s
              AND status = 'installed'
              AND completed_at IS NULL
            """,
            [pending_id],
        )
        if cursor.rowcount != 1:
            raise PhysicalWorkflowStateError(
                "Le workflow a ete modifie concurremment."
            )

    _insert_audit(
        actor_id=actor_id,
        action="installation.validate.v1",
        entity_id=str(pending_id),
        after={
            "order_id": str(order_id),
            "beacon_id": str(beacon_id),
            "order_site_id": str(order_site_id),
            "installation_id": str(installation_id),
            "address_id": str(address_id),
            "status": "done",
            "verification_level": "verified",
            "visibility": "private",
        },
    )

    return {
        "ok": True,
        "status": "done",
        "idempotent": False,
        "pending_installation_id": str(pending_id),
        "order_id": str(order_id),
        "beacon_id": str(beacon_id),
        "order_site_id": str(order_site_id),
        "installation_id": str(installation_id),
        "address_id": str(address_id),
        "visibility": "private",
        "verification_level": "verified",
    }


def _load_publication_target(
    *,
    pending_installation_id: str,
) -> tuple:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                pi.id,
                pi.order_id,
                pi.status,
                pi.beacon_id,
                pi.completed_at,
                o.status AS order_status,
                o.items
            FROM public.pending_installations pi
            JOIN public.orders o
              ON o.id = pi.order_id
            WHERE pi.id = %s
            FOR UPDATE OF pi, o
            """,
            [pending_installation_id],
        )
        pending_row = cursor.fetchone()

    if pending_row is None:
        raise PhysicalWorkflowNotFoundError(
            "Installation a publier introuvable."
        )

    (
        pending_id,
        order_id,
        pending_status,
        beacon_id,
        completed_at,
        order_status,
        order_items,
    ) = pending_row

    requirements = (
        _require_physical_purchase_snapshot(
            items=order_items,
        )
    )

    fulfillment_kind = (
        requirements[
            "fulfillment_kind"
        ]
    )

    _ensure_physical_paid_order(
        order_status=str(order_status),
        fulfillment_kind=str(fulfillment_kind),
    )

    if str(pending_status) != "done":
        raise PhysicalWorkflowStateError(
            "Le workflow doit etre valide et cloture avant publication."
        )

    if completed_at is None:
        raise PhysicalWorkflowStateError(
            "completed_at est obligatoire avant publication."
        )

    if beacon_id is None:
        raise PhysicalWorkflowStateError(
            "Aucune balise n est rattachee a cette adresse."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                a.id,
                a.visibility,
                a.verification_level,
                a.status,
                b.status AS beacon_status,
                b.public_number
            FROM public.addresses a
            JOIN public.beacons b
              ON b.id = a.beacon_id
            WHERE a.beacon_id = %s
            FOR UPDATE OF a, b
            """,
            [beacon_id],
        )
        rows = cursor.fetchall()

    if len(rows) != 1:
        raise PhysicalWorkflowStateError(
            "Une adresse canonique unique est requise avant publication."
        )

    (
        address_id,
        visibility,
        verification_level,
        address_status,
        beacon_status,
        public_number,
    ) = rows[0]

    return (
        pending_id,
        order_id,
        beacon_id,
        address_id,
        visibility,
        verification_level,
        address_status,
        beacon_status,
        public_number,
    )


@transaction.atomic
def publish_physical_address(
    *,
    pending_installation_id: str,
    actor_id: str,
) -> dict[str, Any]:
    (
        pending_id,
        order_id,
        beacon_id,
        address_id,
        visibility,
        verification_level,
        address_status,
        beacon_status,
        public_number,
    ) = _load_publication_target(
        pending_installation_id=pending_installation_id
    )

    if str(address_status) != "active":
        raise PhysicalWorkflowStateError(
            "Seule une adresse active peut etre publiee."
        )

    if str(beacon_status) != "active":
        raise PhysicalWorkflowStateError(
            "La balise doit etre active avant publication."
        )

    if str(verification_level) != "verified":
        raise PhysicalWorkflowStateError(
            "L adresse doit etre verifiee avant publication."
        )

    if str(visibility) == "public":
        return {
            "ok": True,
            "status": "published",
            "idempotent": True,
            "pending_installation_id": str(pending_id),
            "order_id": str(order_id),
            "beacon_id": str(beacon_id),
            "address_id": str(address_id),
            "public_number": str(public_number),
            "visibility": "public",
            "verification_level": "verified",
        }

    if str(visibility) != "private":
        raise PhysicalWorkflowStateError(
            "Visibilite d adresse incompatible avec la publication."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE public.addresses
            SET visibility = 'public'
            WHERE id = %s
              AND status = 'active'
              AND verification_level = 'verified'
              AND visibility = 'private'
            """,
            [address_id],
        )
        if cursor.rowcount != 1:
            raise PhysicalWorkflowStateError(
                "L adresse a ete modifiee concurremment."
            )

    _insert_audit(
        actor_id=actor_id,
        action="address.publish.v1",
        entity_id=str(pending_id),
        after={
            "order_id": str(order_id),
            "beacon_id": str(beacon_id),
            "address_id": str(address_id),
            "public_number": str(public_number),
            "visibility": "public",
            "verification_level": "verified",
        },
    )

    return {
        "ok": True,
        "status": "published",
        "idempotent": False,
        "pending_installation_id": str(pending_id),
        "order_id": str(order_id),
        "beacon_id": str(beacon_id),
        "address_id": str(address_id),
        "public_number": str(public_number),
        "visibility": "public",
        "verification_level": "verified",
    }
