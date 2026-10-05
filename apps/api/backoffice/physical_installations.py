from __future__ import annotations

from typing import Any

from django.db import connection, transaction

class PhysicalInstallationError(RuntimeError):
    code = "PHYSICAL_INSTALLATION_ERROR"


class PhysicalInstallationStateError(PhysicalInstallationError):
    code = "PHYSICAL_INSTALLATION_STATE_INVALID"


class PhysicalInstallationNotFoundError(PhysicalInstallationError):
    code = "PHYSICAL_INSTALLATION_NOT_FOUND"


def _validate_coordinates(*, gps_lat: float, gps_lng: float) -> tuple[float, float]:
    lat = float(gps_lat)
    lng = float(gps_lng)

    if lat < -90 or lat > 90:
        raise PhysicalInstallationStateError("Latitude terrain invalide.")

    if lng < -180 or lng > 180:
        raise PhysicalInstallationStateError("Longitude terrain invalide.")

    return lat, lng


def _load_installed_result(*, pending_installation_id: str) -> dict[str, Any]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                pi.id,
                pi.beacon_id,
                b.public_number,
                a.id AS address_id,
                i.id AS installation_id
            FROM public.pending_installations pi
            JOIN public.beacons b
              ON b.id = pi.beacon_id
            JOIN public.addresses a
              ON a.beacon_id = b.id
            JOIN public.installations i
              ON i.beacon_id = b.id
             AND i.order_site_id IS NOT NULL
             AND i.uninstalled_at IS NULL
            WHERE
                pi.id = %s
                AND pi.status = 'installed'
            ORDER BY i.installed_at DESC
            LIMIT 1
            """,
            [pending_installation_id],
        )
        row = cursor.fetchone()

    if row is None:
        raise PhysicalInstallationStateError(
            "Installation terminee mais resultat canonique introuvable."
        )

    return {
        "ok": True,
        "status": "installed",
        "idempotent": True,
        "pending_installation_id": str(row[0]),
        "beacon_id": str(row[1]),
        "public_number": str(row[2]),
        "address_id": str(row[3]),
        "installation_id": str(row[4]),
    }


@transaction.atomic
def record_physical_installation(
    *,
    pending_installation_id: str,
    actor_id: str,
    agent_id: str,
    gps_lat: float,
    gps_lng: float,
    accuracy_m: float | None = None,
    photo_url: str | None = None,
) -> dict[str, Any]:
    lat, lng = _validate_coordinates(
        gps_lat=gps_lat,
        gps_lng=gps_lng,
    )

    clean_photo = str(photo_url or "").strip() or None
    clean_accuracy = float(accuracy_m) if accuracy_m is not None else None

    if clean_accuracy is not None and clean_accuracy < 0:
        raise PhysicalInstallationStateError("Precision GPS invalide.")

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                pi.id,
                pi.order_id,
                pi.customer_id,
                pi.beacon_id,
                pi.status,
                pi.assigned_agent_id,
                pi.scheduled_at,
                o.status AS order_status,
                o.customer_id AS order_customer_id,
                o.beacon_id AS order_beacon_id,
                cp.code AS plan_code,
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
        row = cursor.fetchone()

    if row is None:
        raise PhysicalInstallationNotFoundError(
            "Installation a planifier introuvable."
        )

    (
        pending_id,
        order_id,
        pending_customer_id,
        pending_beacon_id,
        pending_status,
        assigned_agent_id,
        scheduled_at,
        order_status,
        order_customer_id,
        order_beacon_id,
        _plan_code,
        fulfillment_kind,
    ) = row

    if str(pending_status) == "installed":
        return _load_installed_result(
            pending_installation_id=str(pending_id)
        )

    if str(pending_status) != "planned":
        raise PhysicalInstallationStateError(
            "L installation doit etre planifiee avant l intervention terrain."
        )

    if str(order_status) != "paid":
        raise PhysicalInstallationStateError(
            "La commande doit etre payee avant installation."
        )

    if str(fulfillment_kind) != "physical_installation":
        raise PhysicalInstallationStateError(
            "La commande n'est pas une installation physique."
        )

    customer_id = order_customer_id or pending_customer_id
    if customer_id is None:
        raise PhysicalInstallationStateError("Commande sans proprietaire.")

    if pending_beacon_id is None or order_beacon_id is None:
        raise PhysicalInstallationStateError(
            "La pré-allocation Adresse GN est absente."
        )

    if str(pending_beacon_id) != str(order_beacon_id):
        raise PhysicalInstallationStateError(
            "Les liens de balise pré-allouée sont incohérents."
        )

    if assigned_agent_id is None:
        raise PhysicalInstallationStateError(
            "Aucun agent n est affecte a cette installation."
        )

    if str(assigned_agent_id) != str(agent_id):
        raise PhysicalInstallationStateError(
            "Cette installation est affectee a un autre agent."
        )

    if scheduled_at is None:
        raise PhysicalInstallationStateError(
            "L installation doit avoir une date planifiee."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, active
            FROM public.agents
            WHERE id = %s
            LIMIT 1
            """,
            [agent_id],
        )
        agent = cursor.fetchone()

    if agent is None:
        raise PhysicalInstallationNotFoundError("Agent introuvable.")

    if agent[1] is not True:
        raise PhysicalInstallationStateError("Agent inactif.")

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                beacon_id
            FROM public.order_sites
            WHERE order_id = %s
            ORDER BY sequence_no
            FOR UPDATE
            """,
            [order_id],
        )
        site_rows = cursor.fetchall()

    if len(site_rows) != 1:
        raise PhysicalInstallationStateError(
            "La commande doit contenir exactement un site."
        )

    order_site_id, site_beacon_id = site_rows[0]

    if site_beacon_id is None:
        raise PhysicalInstallationStateError(
            "Le site ne possède pas sa balise pré-allouée."
        )

    if str(site_beacon_id) != str(pending_beacon_id):
        raise PhysicalInstallationStateError(
            "La balise du site diffère de la pré-allocation."
        )

    beacon_id = pending_beacon_id

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                a.id,
                a.owner_id,
                a.visibility,
                a.verification_level,
                a.status,
                b.public_number,
                b.status AS beacon_status
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
        raise PhysicalInstallationStateError(
            "Une adresse pré-allouée unique est requise."
        )

    (
        address_id,
        address_owner_id,
        visibility,
        verification_level,
        address_status,
        public_number,
        beacon_status,
    ) = address_rows[0]

    if address_owner_id is None or str(address_owner_id) != str(customer_id):
        raise PhysicalInstallationStateError(
            "Le propriétaire de l'adresse pré-allouée est incohérent."
        )

    if str(beacon_status) != "active":
        raise PhysicalInstallationStateError(
            "La balise pré-allouée doit être active."
        )

    if str(address_status) != "active":
        raise PhysicalInstallationStateError(
            "L'adresse pré-allouée doit être active."
        )

    if str(visibility) != "private":
        raise PhysicalInstallationStateError(
            "L'adresse ne doit pas être publique avant validation."
        )

    if str(verification_level) not in {"pending", "unverified"}:
        raise PhysicalInstallationStateError(
            "L'adresse pré-allouée a déjà un niveau de vérification incompatible."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE public.addresses
            SET
                location = ST_SetSRID(
                    ST_MakePoint(
                        %s::double precision,
                        %s::double precision
                    ),
                    4326
                )::geography,
                accuracy_m = %s
            WHERE id = %s
              AND beacon_id = %s
              AND visibility = 'private'
              AND status = 'active'
              AND verification_level IN ('pending', 'unverified')
            """,
            [
                lng,
                lat,
                clean_accuracy,
                address_id,
                beacon_id,
            ],
        )
        if cursor.rowcount != 1:
            raise PhysicalInstallationStateError(
                "L'adresse pré-allouée a été modifiée concurremment."
            )

        cursor.execute(
            """
            INSERT INTO public.installations (
                beacon_id,
                agent_id,
                gps_lat,
                gps_lng,
                accuracy_m,
                photo_url,
                installed_at,
                validated_at,
                validator_id,
                order_site_id
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                NOW(),
                NULL,
                NULL,
                %s
            )
            RETURNING id
            """,
            [
                beacon_id,
                agent_id,
                lat,
                lng,
                clean_accuracy,
                clean_photo,
                order_site_id,
            ],
        )
        installation_id = cursor.fetchone()[0]

        cursor.execute(
            """
            UPDATE public.order_sites
            SET
                status = 'done',
                updated_at = NOW()
            WHERE id = %s
              AND beacon_id = %s
            """,
            [order_site_id, beacon_id],
        )
        if cursor.rowcount != 1:
            raise PhysicalInstallationStateError(
                "Le site a ete traite concurremment."
            )

        cursor.execute(
            """
            UPDATE public.orders
            SET
                installed_at = NOW(),
                updated_at = NOW()
            WHERE id = %s
              AND beacon_id = %s
            """,
            [order_id, beacon_id],
        )
        if cursor.rowcount != 1:
            raise PhysicalInstallationStateError(
                "La commande a ete traitee concurremment."
            )

        cursor.execute(
            """
            UPDATE public.pending_installations
            SET
                assigned_agent_id = %s,
                status = 'installed',
                updated_at = NOW()
            WHERE
                id = %s
                AND beacon_id = %s
                AND status = 'planned'
                AND scheduled_at IS NOT NULL
                AND completed_at IS NULL
            """,
            [agent_id, pending_id, beacon_id],
        )
        if cursor.rowcount != 1:
            raise PhysicalInstallationStateError(
                "La demande a ete traitee concurremment."
            )

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
                'installation.field_complete.v1',
                'installations',
                %s,
                jsonb_build_object(
                    'pending_installation_id', %s,
                    'order_id', %s,
                    'order_site_id', %s,
                    'beacon_id', %s,
                    'address_id', %s,
                    'public_number', %s
                )
            )
            RETURNING id
            """,
            [
                actor_id,
                installation_id,
                pending_id,
                order_id,
                order_site_id,
                beacon_id,
                address_id,
                public_number,
            ],
        )
        audit_id = cursor.fetchone()[0]

    return {
        "ok": True,
        "status": "installed",
        "idempotent": False,
        "pending_installation_id": str(pending_id),
        "order_id": str(order_id),
        "order_site_id": str(order_site_id),
        "installation_id": str(installation_id),
        "beacon_id": str(beacon_id),
        "public_number": str(public_number),
        "address_id": str(address_id),
        "owner_id": str(customer_id),
        "audit_id": str(audit_id),
    }
