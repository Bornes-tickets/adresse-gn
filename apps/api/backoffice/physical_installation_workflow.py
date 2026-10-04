from __future__ import annotations

from datetime import datetime
from typing import Any

from django.db import connection, transaction


class PhysicalWorkflowError(RuntimeError):
    code = "PHYSICAL_WORKFLOW_ERROR"


class PhysicalWorkflowNotFoundError(PhysicalWorkflowError):
    code = "PHYSICAL_WORKFLOW_NOT_FOUND"


class PhysicalWorkflowStateError(PhysicalWorkflowError):
    code = "PHYSICAL_WORKFLOW_STATE_INVALID"


def _load_pending_for_update(*, pending_installation_id: str):
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                pi.id,
                pi.order_id,
                pi.status,
                pi.assigned_agent_id,
                pi.scheduled_at,
                pi.completed_at,
                o.status AS order_status,
                cp.fulfillment_kind
            FROM public.pending_installations pi
            JOIN public.orders o
              ON o.id = pi.order_id
            JOIN public.cms_plans cp
              ON cp.id = o.plan_id
            WHERE pi.id = %s
            FOR UPDATE OF pi, o
            """,
            [pending_installation_id],
        )
        return cursor.fetchone()


def _require_active_agent(*, agent_id: str) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT active
            FROM public.agents
            WHERE id = %s
            LIMIT 1
            """,
            [agent_id],
        )
        row = cursor.fetchone()

    if row is None:
        raise PhysicalWorkflowNotFoundError("Agent introuvable.")

    if row[0] is not True:
        raise PhysicalWorkflowStateError("Agent inactif.")


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
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO public.audit_logs (
                actor_id,
                action,
                entity,
                entity_id,
                after
            )
            VALUES (
                %s,
                %s,
                'pending_installations',
                %s,
                %s::jsonb
            )
            """,
            [
                actor_id,
                action,
                entity_id,
                __import__("json").dumps(after),
            ],
        )


@transaction.atomic
def assign_physical_installation(
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
            "Installation a affecter introuvable."
        )

    (
        pending_id,
        order_id,
        current_status,
        assigned_agent_id,
        scheduled_at,
        completed_at,
        order_status,
        fulfillment_kind,
    ) = row

    _ensure_physical_paid_order(
        order_status=str(order_status),
        fulfillment_kind=str(fulfillment_kind),
    )
    _require_active_agent(agent_id=agent_id)

    if str(current_status) == "assigned":
        if str(assigned_agent_id) == str(agent_id):
            return {
                "ok": True,
                "status": "assigned",
                "idempotent": True,
                "pending_installation_id": str(pending_id),
                "order_id": str(order_id),
                "agent_id": str(agent_id),
            }

        raise PhysicalWorkflowStateError(
            "Cette installation est deja affectee a un autre agent."
        )

    if str(current_status) != "pending":
        raise PhysicalWorkflowStateError(
            "Seule une installation en attente peut etre affectee."
        )

    if scheduled_at is not None or completed_at is not None:
        raise PhysicalWorkflowStateError(
            "Etat incoherent: dates operationnelles deja renseignees."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE public.pending_installations
            SET
                assigned_agent_id = %s,
                status = 'assigned',
                updated_at = NOW()
            WHERE id = %s
              AND status = 'pending'
            """,
            [agent_id, pending_id],
        )
        if cursor.rowcount != 1:
            raise PhysicalWorkflowStateError(
                "L'affectation a ete modifiee concurremment."
            )

    _insert_audit(
        actor_id=actor_id,
        action="installation.assign.v1",
        entity_id=str(pending_id),
        after={
            "order_id": str(order_id),
            "agent_id": str(agent_id),
            "status": "assigned",
        },
    )

    return {
        "ok": True,
        "status": "assigned",
        "idempotent": False,
        "pending_installation_id": str(pending_id),
        "order_id": str(order_id),
        "agent_id": str(agent_id),
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
        assigned_agent_id,
        current_scheduled_at,
        completed_at,
        order_status,
        fulfillment_kind,
    ) = row

    _ensure_physical_paid_order(
        order_status=str(order_status),
        fulfillment_kind=str(fulfillment_kind),
    )

    if assigned_agent_id is None:
        raise PhysicalWorkflowStateError(
            "Un agent doit etre affecte avant la planification."
        )

    if completed_at is not None:
        raise PhysicalWorkflowStateError(
            "Une installation terminee ne peut plus etre planifiee."
        )

    if str(current_status) not in {"assigned", "planned"}:
        raise PhysicalWorkflowStateError(
            "L'installation doit etre affectee avant sa planification."
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
              AND status IN ('assigned', 'planned')
              AND assigned_agent_id IS NOT NULL
              AND completed_at IS NULL
            """,
            [scheduled_at, pending_id],
        )
        if cursor.rowcount != 1:
            raise PhysicalWorkflowStateError(
                "La planification a ete modifiee concurremment."
            )

    _insert_audit(
        actor_id=actor_id,
        action="installation.schedule.v1",
        entity_id=str(pending_id),
        after={
            "order_id": str(order_id),
            "agent_id": str(assigned_agent_id),
            "status": "planned",
            "scheduled_at": scheduled_at.isoformat(),
        },
    )

    return {
        "ok": True,
        "status": "planned",
        "idempotent": False,
        "pending_installation_id": str(pending_id),
        "order_id": str(order_id),
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
                cp.fulfillment_kind
            FROM public.pending_installations pi
            JOIN public.orders o
              ON o.id = pi.order_id
            JOIN public.cms_plans cp
              ON cp.id = o.plan_id
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
        fulfillment_kind,
    ) = pending_row

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
                id,
                verification_level,
                visibility,
                status
            FROM public.addresses
            WHERE beacon_id = %s
            FOR UPDATE
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
    ) = _load_validation_targets(
        pending_installation_id=pending_installation_id
    )

    if str(pending_status) == "done":
        if (
            completed_at is None
            or validated_at is None
            or str(verification_level) != "verified"
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
                cp.fulfillment_kind
            FROM public.pending_installations pi
            JOIN public.orders o
              ON o.id = pi.order_id
            JOIN public.cms_plans cp
              ON cp.id = o.plan_id
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
        fulfillment_kind,
    ) = pending_row

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
