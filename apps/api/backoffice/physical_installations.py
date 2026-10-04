from __future__ import annotations

from typing import Any

from django.db import connection, transaction

from payments.services import (
    SalesPaymentFulfillmentError,
    _ADDRESS_CATEGORY_BY_PLACE_TYPE,
    _next_v1_beacon_number,
)


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


def _load_completed_result(*, pending_installation_id: str) -> dict[str, Any]:
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
                AND pi.status = 'done'
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
        "status": "done",
        "idempotent": True,
        "pending_installation_id": str(row[0]),
        "beacon_id": str(row[1]),
        "public_number": str(row[2]),
        "address_id": str(row[3]),
        "installation_id": str(row[4]),
    }


@transaction.atomic
def complete_physical_installation(
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
        order_status,
        order_customer_id,
        order_beacon_id,
        plan_code,
        fulfillment_kind,
    ) = row

    if str(pending_status) == "done":
        return _load_completed_result(
            pending_installation_id=str(pending_id)
        )

    if str(pending_status) not in {"pending", "assigned", "planned"}:
        raise PhysicalInstallationStateError(
            "Cette installation ne peut pas etre finalisee dans son etat actuel."
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

    if pending_beacon_id is not None or order_beacon_id is not None:
        raise PhysicalInstallationStateError(
            "Une balise existe deja sans installation terminee."
        )

    if assigned_agent_id is not None and str(assigned_agent_id) != str(agent_id):
        raise PhysicalInstallationStateError(
            "Cette installation est affectee a un autre agent."
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
                sequence_no,
                place_type,
                place_name,
                commune_id,
                district_id,
                sector_id,
                access_point_note,
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

    (
        order_site_id,
        _sequence_no,
        place_type,
        place_name,
        commune_id,
        district_id,
        sector_id,
        access_point_note,
        site_beacon_id,
    ) = site_rows[0]

    if site_beacon_id is not None:
        raise PhysicalInstallationStateError(
            "Le site possede deja une balise."
        )

    if commune_id is None:
        raise PhysicalInstallationStateError("La commune est obligatoire.")

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT code, is_active
            FROM public.communes
            WHERE id = %s
            LIMIT 1
            """,
            [commune_id],
        )
        commune = cursor.fetchone()

    if commune is None:
        raise PhysicalInstallationNotFoundError("Commune introuvable.")

    if commune[1] is not True:
        raise PhysicalInstallationStateError("Commune inactive.")

    try:
        numbering = _next_v1_beacon_number(
            commune_code=str(commune[0]).strip().upper()
        )
    except SalesPaymentFulfillmentError as exc:
        raise PhysicalInstallationStateError(str(exc)) from exc

    public_number = numbering["public_number"]
    normalized_place_type = str(place_type or "other").strip().lower()
    address_category = _ADDRESS_CATEGORY_BY_PLACE_TYPE.get(
        normalized_place_type,
        "other",
    )

    beacon_category_by_plan = {
        "residentiel_standard": "residential",
        "residentiel_premium": "residential_plus",
    }

    beacon_category = beacon_category_by_plan.get(
        str(plan_code or "").strip()
    )

    if beacon_category is None:
        raise PhysicalInstallationStateError(
            "Plan physique non pris en charge pour la categorie de balise."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO public.beacons (
                public_number,
                status,
                category,
                lot_id,
                activated_at,
                national_id,
                check_digit,
                commune_code_at_issue,
                numbering_version
            )
            VALUES (
                %s,
                'active',
                %s,
                NULL,
                NOW(),
                %s,
                %s,
                %s,
                'v1'
            )
            RETURNING id
            """,
            [
                public_number,
                beacon_category,
                numbering["national_id"],
                numbering["check_digit"],
                numbering["commune_code_at_issue"],
            ],
        )
        beacon_id = cursor.fetchone()[0]

        cursor.execute(
            """
            INSERT INTO public.addresses (
                beacon_id,
                owner_id,
                category,
                name,
                location,
                accuracy_m,
                visibility,
                verification_level,
                access_point_note,
                status,
                commune_id,
                district_id,
                sector_id
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                ST_SetSRID(
                    ST_MakePoint(
                        %s::double precision,
                        %s::double precision
                    ),
                    4326
                )::geography,
                %s,
                'private',
                'verified',
                %s,
                'active',
                %s,
                %s,
                %s
            )
            RETURNING id
            """,
            [
                beacon_id,
                customer_id,
                address_category,
                place_name,
                lng,
                lat,
                clean_accuracy,
                access_point_note,
                commune_id,
                district_id,
                sector_id,
            ],
        )
        address_id = cursor.fetchone()[0]

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
                NOW(),
                %s,
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
                actor_id,
                order_site_id,
            ],
        )
        installation_id = cursor.fetchone()[0]

        cursor.execute(
            """
            UPDATE public.order_sites
            SET
                beacon_id = %s,
                status = 'done',
                updated_at = NOW()
            WHERE id = %s
              AND beacon_id IS NULL
            """,
            [beacon_id, order_site_id],
        )
        if cursor.rowcount != 1:
            raise PhysicalInstallationStateError(
                "Le site a ete traite concurremment."
            )

        cursor.execute(
            """
            UPDATE public.orders
            SET
                beacon_id = %s,
                installed_at = NOW(),
                updated_at = NOW()
            WHERE id = %s
              AND beacon_id IS NULL
            """,
            [beacon_id, order_id],
        )
        if cursor.rowcount != 1:
            raise PhysicalInstallationStateError(
                "La commande a ete traitee concurremment."
            )

        cursor.execute(
            """
            UPDATE public.pending_installations
            SET
                beacon_id = %s,
                assigned_agent_id = %s,
                status = 'done',
                scheduled_at = COALESCE(scheduled_at, NOW()),
                completed_at = NOW(),
                updated_at = NOW()
            WHERE
                id = %s
                AND status IN ('pending', 'assigned', 'planned')
                AND beacon_id IS NULL
            """,
            [beacon_id, agent_id, pending_id],
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
                'installation.complete.v1',
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
        "status": "done",
        "idempotent": False,
        "pending_installation_id": str(pending_id),
        "order_id": str(order_id),
        "order_site_id": str(order_site_id),
        "installation_id": str(installation_id),
        "beacon_id": str(beacon_id),
        "public_number": public_number,
        "address_id": str(address_id),
        "owner_id": str(customer_id),
        "audit_id": str(audit_id),
    }
