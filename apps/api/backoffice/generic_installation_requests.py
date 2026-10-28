from __future__ import annotations

import json
from typing import Any

from django.db import connection, transaction


SOURCE_TYPES = {
    "customer_order",
    "institutional",
    "internal",
    "campaign",
    "replacement",
    "regularization",
    "other",
}

PRIORITIES = {
    "low",
    "normal",
    "high",
    "urgent",
}


class GenericInstallationRequestError(RuntimeError):
    code = "GENERIC_INSTALLATION_REQUEST_ERROR"


class GenericInstallationRequestNotFoundError(
    GenericInstallationRequestError
):
    code = "GENERIC_INSTALLATION_REQUEST_NOT_FOUND"


class GenericInstallationRequestStateError(
    GenericInstallationRequestError
):
    code = "GENERIC_INSTALLATION_REQUEST_STATE_INVALID"


class GenericInstallationRequestValidationError(
    GenericInstallationRequestError
):
    code = "GENERIC_INSTALLATION_REQUEST_VALIDATION_ERROR"


def _clean_text(
    value: Any,
    *,
    max_length: int,
) -> str | None:
    clean = str(value or "").strip()

    if not clean:
        return None

    return clean[:max_length]


def _normalize_coordinates(
    *,
    lat: float | None,
    lng: float | None,
    accuracy_m: float | None,
) -> tuple[float | None, float | None, float | None]:
    if (lat is None) != (lng is None):
        raise GenericInstallationRequestValidationError(
            "Latitude et longitude doivent être fournies ensemble."
        )

    clean_lat = (
        float(lat)
        if lat is not None
        else None
    )
    clean_lng = (
        float(lng)
        if lng is not None
        else None
    )
    clean_accuracy = (
        float(accuracy_m)
        if accuracy_m is not None
        else None
    )

    if (
        clean_lat is not None
        and not -90 <= clean_lat <= 90
    ):
        raise GenericInstallationRequestValidationError(
            "Latitude cible invalide."
        )

    if (
        clean_lng is not None
        and not -180 <= clean_lng <= 180
    ):
        raise GenericInstallationRequestValidationError(
            "Longitude cible invalide."
        )

    if (
        clean_accuracy is not None
        and clean_accuracy < 0
    ):
        raise GenericInstallationRequestValidationError(
            "Précision GPS cible invalide."
        )

    return (
        clean_lat,
        clean_lng,
        clean_accuracy,
    )


def _normalize_create_payload(
    *,
    source_type: str,
    title: str,
    category: str,
    quantity: int,
    commune_id: str,
    priority: str = "normal",
    order_id: str | None = None,
    source_reference: str | None = None,
    customer_id: str | None = None,
    business_id: str | None = None,
    beneficiary_name: str | None = None,
    beneficiary_phone: str | None = None,
    beneficiary_email: str | None = None,
    reason: str | None = None,
    district_id: str | None = None,
    sector_id: str | None = None,
    requested_lat: float | None = None,
    requested_lng: float | None = None,
    location_accuracy_m: float | None = None,
    address_line: str | None = None,
    access_point_note: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    clean_source_type = str(
        source_type or ""
    ).strip()

    if clean_source_type not in SOURCE_TYPES:
        raise GenericInstallationRequestValidationError(
            "Origine de demande d'installation invalide."
        )

    clean_priority = str(
        priority or "normal"
    ).strip()

    if clean_priority not in PRIORITIES:
        raise GenericInstallationRequestValidationError(
            "Priorité de demande invalide."
        )

    clean_title = _clean_text(
        title,
        max_length=240,
    )

    if clean_title is None:
        raise GenericInstallationRequestValidationError(
            "Le titre de la demande est obligatoire."
        )

    clean_category = _clean_text(
        category,
        max_length=80,
    )

    if clean_category is None:
        raise GenericInstallationRequestValidationError(
            "La catégorie de balise est obligatoire."
        )

    clean_commune_id = _clean_text(
        commune_id,
        max_length=80,
    )

    if clean_commune_id is None:
        raise GenericInstallationRequestValidationError(
            "La commune cible est obligatoire."
        )

    try:
        clean_quantity = int(quantity)
    except (
        TypeError,
        ValueError,
    ) as exc:
        raise GenericInstallationRequestValidationError(
            "La quantité doit être un entier positif."
        ) from exc

    if clean_quantity <= 0:
        raise GenericInstallationRequestValidationError(
            "La quantité doit être strictement positive."
        )

    clean_order_id = _clean_text(
        order_id,
        max_length=80,
    )

    if (
        clean_source_type == "customer_order"
        and clean_order_id is None
    ):
        raise GenericInstallationRequestValidationError(
            "Une demande customer_order doit référencer une commande."
        )

    (
        clean_lat,
        clean_lng,
        clean_accuracy,
    ) = _normalize_coordinates(
        lat=requested_lat,
        lng=requested_lng,
        accuracy_m=location_accuracy_m,
    )

    clean_metadata = (
        metadata
        if metadata is not None
        else {}
    )

    if not isinstance(
        clean_metadata,
        dict,
    ):
        raise GenericInstallationRequestValidationError(
            "metadata doit être un objet JSON."
        )

    try:
        json.dumps(
            clean_metadata,
            ensure_ascii=False,
        )
    except (
        TypeError,
        ValueError,
    ) as exc:
        raise GenericInstallationRequestValidationError(
            "metadata n'est pas sérialisable en JSON."
        ) from exc

    return {
        "source_type": clean_source_type,
        "source_reference": _clean_text(
            source_reference,
            max_length=240,
        ),
        "order_id": clean_order_id,
        "customer_id": _clean_text(
            customer_id,
            max_length=80,
        ),
        "business_id": _clean_text(
            business_id,
            max_length=80,
        ),
        "beneficiary_name": _clean_text(
            beneficiary_name,
            max_length=240,
        ),
        "beneficiary_phone": _clean_text(
            beneficiary_phone,
            max_length=80,
        ),
        "beneficiary_email": _clean_text(
            beneficiary_email,
            max_length=320,
        ),
        "title": clean_title,
        "reason": _clean_text(
            reason,
            max_length=2000,
        ),
        "priority": clean_priority,
        "category": clean_category,
        "quantity": clean_quantity,
        "commune_id": clean_commune_id,
        "district_id": _clean_text(
            district_id,
            max_length=80,
        ),
        "sector_id": _clean_text(
            sector_id,
            max_length=80,
        ),
        "requested_lat": clean_lat,
        "requested_lng": clean_lng,
        "location_accuracy_m": clean_accuracy,
        "address_line": _clean_text(
            address_line,
            max_length=500,
        ),
        "access_point_note": _clean_text(
            access_point_note,
            max_length=1000,
        ),
        "metadata": clean_metadata,
    }


def _validate_reference_scope(
    *,
    payload: dict[str, Any],
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM public.beacon_categories bc
                WHERE bc.code = %s
            )
            """,
            [
                payload["category"],
            ],
        )

        if cursor.fetchone()[0] is not True:
            raise GenericInstallationRequestValidationError(
                "Catégorie de balise inconnue."
            )

        cursor.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM public.communes c
                WHERE c.id = %s
            )
            """,
            [
                payload["commune_id"],
            ],
        )

        if cursor.fetchone()[0] is not True:
            raise GenericInstallationRequestValidationError(
                "Commune cible inconnue."
            )

        if payload["district_id"] is not None:
            cursor.execute(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM public.districts d
                    WHERE
                        d.id = %s
                        AND d.commune_id = %s
                )
                """,
                [
                    payload["district_id"],
                    payload["commune_id"],
                ],
            )

            if cursor.fetchone()[0] is not True:
                raise GenericInstallationRequestValidationError(
                    "Le quartier/district ne correspond pas à la commune."
                )

        if payload["sector_id"] is not None:
            cursor.execute(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM public.sectors s
                    JOIN public.districts d
                      ON d.id = s.district_id
                    WHERE
                        s.id = %s
                        AND d.commune_id = %s
                        AND (
                            %s IS NULL
                            OR s.district_id = %s
                        )
                )
                """,
                [
                    payload["sector_id"],
                    payload["commune_id"],
                    payload["district_id"],
                    payload["district_id"],
                ],
            )

            if cursor.fetchone()[0] is not True:
                raise GenericInstallationRequestValidationError(
                    "Le secteur ne correspond pas au district/à la commune."
                )

        for key, table in (
            (
                "customer_id",
                "profiles",
            ),
            (
                "business_id",
                "business_profiles",
            ),
        ):
            value = payload[key]

            if value is None:
                continue

            cursor.execute(
                f"""
                SELECT EXISTS (
                    SELECT 1
                    FROM public.{table}
                    WHERE id = %s
                )
                """,
                [
                    value,
                ],
            )

            if cursor.fetchone()[0] is not True:
                raise GenericInstallationRequestValidationError(
                    f"Référence {key} inconnue."
                )

        if payload["order_id"] is not None:
            cursor.execute(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM public.orders o
                    WHERE o.id = %s
                )
                """,
                [
                    payload["order_id"],
                ],
            )

            if cursor.fetchone()[0] is not True:
                raise GenericInstallationRequestValidationError(
                    "Commande source inconnue."
                )


def _next_request_reference() -> str:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                EXTRACT(
                    YEAR
                    FROM NOW()
                )::integer
            """
        )
        year = int(
            cursor.fetchone()[0]
        )

        cursor.execute(
            """
            SELECT pg_advisory_xact_lock(
                hashtext(%s)
            )
            """,
            [
                (
                    "installation_requests."
                    f"reference.{year}"
                )
            ],
        )

        prefix = (
            f"REQ-{year}-"
        )

        cursor.execute(
            """
            SELECT
                COALESCE(
                    MAX(
                        RIGHT(
                            reference,
                            6
                        )::integer
                    ),
                    0
                ) + 1
            FROM public.installation_requests
            WHERE reference LIKE %s
            """,
            [
                prefix + "%",
            ],
        )

        sequence = int(
            cursor.fetchone()[0]
        )

    if sequence > 999999:
        raise GenericInstallationRequestStateError(
            "Capacité annuelle des références de demandes épuisée."
        )

    return (
        prefix
        + f"{sequence:06d}"
    )


def _insert_audit(
    *,
    actor_id: str,
    action: str,
    entity: str,
    entity_id: str,
    before: dict[str, Any] | None,
    after: dict[str, Any],
) -> str:
    before_json = (
        json.dumps(
            before,
            ensure_ascii=False,
        )
        if before is not None
        else None
    )

    after_json = json.dumps(
        after,
        ensure_ascii=False,
    )

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
                %s,
                %s,
                %s::jsonb,
                %s::jsonb
            )
            RETURNING id
            """,
            [
                actor_id,
                action,
                entity,
                entity_id,
                before_json,
                after_json,
            ],
        )

        row = cursor.fetchone()

    return str(
        row[0]
    )


def _load_request_for_update(
    *,
    request_id: str,
):
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                ir.id,
                ir.reference,
                ir.source_type,
                ir.source_reference,
                ir.order_id,
                ir.customer_id,
                ir.business_id,
                ir.beneficiary_name,
                ir.beneficiary_phone,
                ir.beneficiary_email,
                ir.title,
                ir.reason,
                ir.priority,
                ir.status,
                ir.category,
                ir.quantity,
                ir.commune_id,
                ir.district_id,
                ir.sector_id,
                CASE
                    WHEN ir.requested_location IS NULL
                    THEN NULL
                    ELSE ST_Y(
                        ir.requested_location::geometry
                    )
                END AS requested_lat,
                CASE
                    WHEN ir.requested_location IS NULL
                    THEN NULL
                    ELSE ST_X(
                        ir.requested_location::geometry
                    )
                END AS requested_lng,
                ir.location_accuracy_m,
                ir.address_line,
                ir.access_point_note,
                ir.requested_by,
                ir.approved_by,
                ir.approved_at,
                ir.completed_at,
                ir.cancelled_at,
                ir.metadata,
                ir.created_at,
                ir.updated_at
            FROM public.installation_requests ir
            WHERE ir.id = %s
            FOR UPDATE
            """,
            [
                request_id,
            ],
        )

        return cursor.fetchone()


def _request_state_payload(
    row,
) -> dict[str, Any]:
    return {
        "id": str(
            row[0]
        ),
        "reference": str(
            row[1]
        ),
        "source_type": str(
            row[2]
        ),
        "source_reference": row[3],
        "order_id": (
            str(row[4])
            if row[4] is not None
            else None
        ),
        "customer_id": (
            str(row[5])
            if row[5] is not None
            else None
        ),
        "business_id": (
            str(row[6])
            if row[6] is not None
            else None
        ),
        "beneficiary_name": row[7],
        "beneficiary_phone": row[8],
        "beneficiary_email": row[9],
        "title": row[10],
        "reason": row[11],
        "priority": str(
            row[12]
        ),
        "status": str(
            row[13]
        ),
        "category": str(
            row[14]
        ),
        "quantity": int(
            row[15]
        ),
        "commune_id": str(
            row[16]
        ),
        "district_id": (
            str(row[17])
            if row[17] is not None
            else None
        ),
        "sector_id": (
            str(row[18])
            if row[18] is not None
            else None
        ),
        "requested_lat": (
            float(row[19])
            if row[19] is not None
            else None
        ),
        "requested_lng": (
            float(row[20])
            if row[20] is not None
            else None
        ),
        "location_accuracy_m": (
            float(row[21])
            if row[21] is not None
            else None
        ),
        "address_line": row[22],
        "access_point_note": row[23],
        "requested_by": (
            str(row[24])
            if row[24] is not None
            else None
        ),
        "approved_by": (
            str(row[25])
            if row[25] is not None
            else None
        ),
        "approved_at": (
            row[26].isoformat()
            if row[26] is not None
            else None
        ),
        "completed_at": (
            row[27].isoformat()
            if row[27] is not None
            else None
        ),
        "cancelled_at": (
            row[28].isoformat()
            if row[28] is not None
            else None
        ),
        "metadata": (
            row[29]
            if isinstance(
                row[29],
                dict,
            )
            else {}
        ),
        "created_at": (
            row[30].isoformat()
            if row[30] is not None
            else None
        ),
        "updated_at": (
            row[31].isoformat()
            if row[31] is not None
            else None
        ),
    }


@transaction.atomic
def create_installation_request(
    *,
    actor_id: str,
    source_type: str,
    title: str,
    category: str,
    quantity: int,
    commune_id: str,
    priority: str = "normal",
    source_reference: str | None = None,
    order_id: str | None = None,
    customer_id: str | None = None,
    business_id: str | None = None,
    beneficiary_name: str | None = None,
    beneficiary_phone: str | None = None,
    beneficiary_email: str | None = None,
    reason: str | None = None,
    district_id: str | None = None,
    sector_id: str | None = None,
    requested_lat: float | None = None,
    requested_lng: float | None = None,
    location_accuracy_m: float | None = None,
    address_line: str | None = None,
    access_point_note: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload = _normalize_create_payload(
        source_type=source_type,
        title=title,
        category=category,
        quantity=quantity,
        commune_id=commune_id,
        priority=priority,
        order_id=order_id,
        source_reference=source_reference,
        customer_id=customer_id,
        business_id=business_id,
        beneficiary_name=beneficiary_name,
        beneficiary_phone=beneficiary_phone,
        beneficiary_email=beneficiary_email,
        reason=reason,
        district_id=district_id,
        sector_id=sector_id,
        requested_lat=requested_lat,
        requested_lng=requested_lng,
        location_accuracy_m=location_accuracy_m,
        address_line=address_line,
        access_point_note=access_point_note,
        metadata=metadata,
    )

    _validate_reference_scope(
        payload=payload,
    )

    reference = (
        _next_request_reference()
    )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO public.installation_requests (
                reference,
                source_type,
                source_reference,
                order_id,
                customer_id,
                business_id,
                beneficiary_name,
                beneficiary_phone,
                beneficiary_email,
                title,
                reason,
                priority,
                status,
                category,
                quantity,
                commune_id,
                district_id,
                sector_id,
                requested_location,
                location_accuracy_m,
                address_line,
                access_point_note,
                requested_by,
                metadata
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                'draft',
                %s,
                %s,
                %s,
                %s,
                %s,
                CASE
                    WHEN %s IS NULL
                    THEN NULL
                    ELSE ST_SetSRID(
                        ST_MakePoint(
                            %s::double precision,
                            %s::double precision
                        ),
                        4326
                    )::geography
                END,
                %s,
                %s,
                %s,
                %s,
                %s::jsonb
            )
            RETURNING
                id,
                created_at
            """,
            [
                reference,
                payload["source_type"],
                payload["source_reference"],
                payload["order_id"],
                payload["customer_id"],
                payload["business_id"],
                payload["beneficiary_name"],
                payload["beneficiary_phone"],
                payload["beneficiary_email"],
                payload["title"],
                payload["reason"],
                payload["priority"],
                payload["category"],
                payload["quantity"],
                payload["commune_id"],
                payload["district_id"],
                payload["sector_id"],
                payload["requested_lat"],
                payload["requested_lng"],
                payload["requested_lat"],
                payload["location_accuracy_m"],
                payload["address_line"],
                payload["access_point_note"],
                actor_id,
                json.dumps(
                    payload["metadata"],
                    ensure_ascii=False,
                ),
            ],
        )

        request_id, created_at = (
            cursor.fetchone()
        )

    audit_id = _insert_audit(
        actor_id=actor_id,
        action=(
            "installation_request.create.v1"
        ),
        entity="installation_requests",
        entity_id=str(
            request_id
        ),
        before=None,
        after={
            "reference": reference,
            "source_type": payload[
                "source_type"
            ],
            "source_reference": payload[
                "source_reference"
            ],
            "order_id": payload[
                "order_id"
            ],
            "customer_id": payload[
                "customer_id"
            ],
            "business_id": payload[
                "business_id"
            ],
            "title": payload[
                "title"
            ],
            "priority": payload[
                "priority"
            ],
            "status": "draft",
            "category": payload[
                "category"
            ],
            "quantity": payload[
                "quantity"
            ],
            "commune_id": payload[
                "commune_id"
            ],
            "district_id": payload[
                "district_id"
            ],
            "sector_id": payload[
                "sector_id"
            ],
        },
    )

    return {
        "ok": True,
        "status": "draft",
        "request_id": str(
            request_id
        ),
        "reference": reference,
        "source_type": payload[
            "source_type"
        ],
        "quantity": payload[
            "quantity"
        ],
        "created_at": (
            created_at.isoformat()
            if created_at is not None
            else None
        ),
        "audit_id": audit_id,
    }


@transaction.atomic
def submit_installation_request(
    *,
    request_id: str,
    actor_id: str,
) -> dict[str, Any]:
    row = _load_request_for_update(
        request_id=request_id,
    )

    if row is None:
        raise GenericInstallationRequestNotFoundError(
            "Demande d'installation introuvable."
        )

    before = _request_state_payload(
        row
    )

    if before["status"] == "pending_approval":
        return {
            "ok": True,
            "status": "pending_approval",
            "idempotent": True,
            "request_id": before["id"],
            "reference": before["reference"],
        }

    if before["status"] != "draft":
        raise GenericInstallationRequestStateError(
            "Seule une demande brouillon peut être soumise."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM public.installation_tasks
            WHERE request_id = %s
            """,
            [
                before["id"],
            ],
        )

        if int(
            cursor.fetchone()[0]
        ) != 0:
            raise GenericInstallationRequestStateError(
                "Aucune tâche ne doit exister avant approbation."
            )

        cursor.execute(
            """
            UPDATE public.installation_requests
            SET
                status = 'pending_approval',
                updated_at = NOW()
            WHERE
                id = %s
                AND status = 'draft'
            RETURNING updated_at
            """,
            [
                before["id"],
            ],
        )

        updated = cursor.fetchone()

    if updated is None:
        raise GenericInstallationRequestStateError(
            "La demande a été modifiée concurremment."
        )

    after = dict(
        before
    )
    after["status"] = (
        "pending_approval"
    )
    after["updated_at"] = (
        updated[0].isoformat()
        if updated[0] is not None
        else None
    )

    audit_id = _insert_audit(
        actor_id=actor_id,
        action=(
            "installation_request.submit.v1"
        ),
        entity="installation_requests",
        entity_id=before["id"],
        before=before,
        after=after,
    )

    return {
        "ok": True,
        "status": "pending_approval",
        "idempotent": False,
        "request_id": before["id"],
        "reference": before[
            "reference"
        ],
        "audit_id": audit_id,
    }


def _existing_task_ids(
    *,
    request_id: str,
) -> list[str]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id
            FROM public.installation_tasks
            WHERE request_id = %s
            ORDER BY sequence_no
            """,
            [
                request_id,
            ],
        )

        return [
            str(row[0])
            for row in cursor.fetchall()
        ]


@transaction.atomic
def approve_installation_request(
    *,
    request_id: str,
    actor_id: str,
) -> dict[str, Any]:
    row = _load_request_for_update(
        request_id=request_id,
    )

    if row is None:
        raise GenericInstallationRequestNotFoundError(
            "Demande d'installation introuvable."
        )

    before = _request_state_payload(
        row
    )

    existing_task_ids = (
        _existing_task_ids(
            request_id=before["id"],
        )
    )

    if before["status"] == "approved":
        if (
            len(existing_task_ids)
            == before["quantity"]
        ):
            return {
                "ok": True,
                "status": "approved",
                "idempotent": True,
                "request_id": before["id"],
                "reference": before[
                    "reference"
                ],
                "task_count": len(
                    existing_task_ids
                ),
                "task_ids": (
                    existing_task_ids
                ),
            }

        raise GenericInstallationRequestStateError(
            "Demande approuvée avec cardinalité de tâches incohérente."
        )

    if before["status"] != "pending_approval":
        raise GenericInstallationRequestStateError(
            "Seule une demande en attente d'approbation peut être approuvée."
        )

    if existing_task_ids:
        raise GenericInstallationRequestStateError(
            "Des tâches existent avant l'approbation de la demande."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE public.installation_requests
            SET
                status = 'approved',
                approved_by = %s,
                approved_at = NOW(),
                updated_at = NOW()
            WHERE
                id = %s
                AND status = 'pending_approval'
            RETURNING
                approved_at,
                updated_at
            """,
            [
                actor_id,
                before["id"],
            ],
        )

        approval_row = (
            cursor.fetchone()
        )

        if approval_row is None:
            raise GenericInstallationRequestStateError(
                "La demande a été modifiée concurremment."
            )

        cursor.execute(
            """
            INSERT INTO public.installation_tasks (
                request_id,
                sequence_no,
                category,
                commune_id,
                district_id,
                sector_id,
                target_location,
                target_accuracy_m,
                address_line,
                access_point_note,
                beacon_id,
                assigned_agent_id,
                installation_id,
                status,
                metadata
            )
            SELECT
                ir.id,
                generated.sequence_no,
                ir.category,
                ir.commune_id,
                ir.district_id,
                ir.sector_id,
                ir.requested_location,
                ir.location_accuracy_m,
                ir.address_line,
                ir.access_point_note,
                NULL,
                NULL,
                NULL,
                'pending',
                jsonb_build_object(
                    'generated_by',
                    'installation_request.approve.v1'
                )
            FROM public.installation_requests ir
            CROSS JOIN LATERAL
                generate_series(
                    1,
                    ir.quantity
                ) AS generated(
                    sequence_no
                )
            WHERE
                ir.id = %s
                AND ir.status = 'approved'
            ORDER BY
                generated.sequence_no
            RETURNING
                id,
                sequence_no,
                status,
                beacon_id,
                assigned_agent_id,
                installation_id
            """,
            [
                before["id"],
            ],
        )

        generated_rows = (
            cursor.fetchall()
        )

    if (
        len(generated_rows)
        != before["quantity"]
    ):
        raise GenericInstallationRequestStateError(
            "La génération atomique des tâches est incomplète."
        )

    for generated in generated_rows:
        (
            _task_id,
            sequence_no,
            task_status,
            beacon_id,
            assigned_agent_id,
            installation_id,
        ) = generated

        if int(sequence_no) <= 0:
            raise GenericInstallationRequestStateError(
                "Séquence de tâche invalide."
            )

        if str(
            task_status
        ) != "pending":
            raise GenericInstallationRequestStateError(
                "Une nouvelle tâche doit être pending."
            )

        if (
            beacon_id is not None
            or assigned_agent_id is not None
            or installation_id is not None
        ):
            raise GenericInstallationRequestStateError(
                "A2 ne doit affecter ni balise, ni agent, ni installation."
            )

    task_ids = [
        str(row[0])
        for row in generated_rows
    ]

    after = dict(
        before
    )
    after.update(
        {
            "status": "approved",
            "approved_by": str(
                actor_id
            ),
            "approved_at": (
                approval_row[0].isoformat()
                if approval_row[0]
                is not None
                else None
            ),
            "updated_at": (
                approval_row[1].isoformat()
                if approval_row[1]
                is not None
                else None
            ),
            "generated_task_count": len(
                task_ids
            ),
            "generated_task_ids": (
                task_ids
            ),
        }
    )

    audit_id = _insert_audit(
        actor_id=actor_id,
        action=(
            "installation_request.approve.v1"
        ),
        entity="installation_requests",
        entity_id=before["id"],
        before=before,
        after=after,
    )

    return {
        "ok": True,
        "status": "approved",
        "idempotent": False,
        "request_id": before["id"],
        "reference": before[
            "reference"
        ],
        "task_count": len(
            task_ids
        ),
        "task_ids": task_ids,
        "audit_id": audit_id,
    }


@transaction.atomic
def cancel_installation_request(
    *,
    request_id: str,
    actor_id: str,
    reason: str | None = None,
) -> dict[str, Any]:
    row = _load_request_for_update(
        request_id=request_id,
    )

    if row is None:
        raise GenericInstallationRequestNotFoundError(
            "Demande d'installation introuvable."
        )

    before = _request_state_payload(
        row
    )

    if before["status"] == "cancelled":
        return {
            "ok": True,
            "status": "cancelled",
            "idempotent": True,
            "request_id": before["id"],
            "reference": before[
                "reference"
            ],
        }

    if before["status"] in {
        "in_progress",
        "completed",
    }:
        raise GenericInstallationRequestStateError(
            "Une demande en cours ou terminée ne peut pas être annulée par A2."
        )

    clean_reason = _clean_text(
        reason,
        max_length=1000,
    )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                status
            FROM public.installation_tasks
            WHERE request_id = %s
            ORDER BY sequence_no
            FOR UPDATE
            """,
            [
                before["id"],
            ],
        )

        task_status_rows = (
            cursor.fetchall()
        )

        invalid_task_states = [
            str(task_status)
            for _task_id, task_status
            in task_status_rows
            if str(task_status)
            not in {
                "pending",
                "cancelled",
            }
        ]

        if invalid_task_states:
            raise GenericInstallationRequestStateError(
                "La demande possède déjà des tâches engagées sur le terrain."
            )

        cursor.execute(
            """
            UPDATE public.installation_tasks
            SET
                status = 'cancelled',
                cancelled_at = NOW(),
                notes = CASE
                    WHEN %s IS NULL
                    THEN notes
                    WHEN notes IS NULL
                    THEN %s
                    ELSE notes || E'\\n' || %s
                END,
                updated_at = NOW()
            WHERE
                request_id = %s
                AND status = 'pending'
            RETURNING id
            """,
            [
                clean_reason,
                clean_reason,
                clean_reason,
                before["id"],
            ],
        )

        cancelled_task_ids = [
            str(task_row[0])
            for task_row
            in cursor.fetchall()
        ]

        cursor.execute(
            """
            UPDATE public.installation_requests
            SET
                status = 'cancelled',
                cancelled_at = NOW(),
                updated_at = NOW(),
                metadata = metadata
                    || jsonb_build_object(
                        'cancellation_reason',
                        %s
                    )
            WHERE
                id = %s
                AND status IN (
                    'draft',
                    'pending_approval',
                    'approved'
                )
            RETURNING
                cancelled_at,
                updated_at
            """,
            [
                clean_reason,
                before["id"],
            ],
        )

        cancelled_request = (
            cursor.fetchone()
        )

    if cancelled_request is None:
        raise GenericInstallationRequestStateError(
            "La demande a été modifiée concurremment."
        )

    after = dict(
        before
    )
    after.update(
        {
            "status": "cancelled",
            "cancelled_at": (
                cancelled_request[
                    0
                ].isoformat()
                if cancelled_request[
                    0
                ] is not None
                else None
            ),
            "updated_at": (
                cancelled_request[
                    1
                ].isoformat()
                if cancelled_request[
                    1
                ] is not None
                else None
            ),
            "cancellation_reason": (
                clean_reason
            ),
            "cancelled_task_ids": (
                cancelled_task_ids
            ),
        }
    )

    audit_id = _insert_audit(
        actor_id=actor_id,
        action=(
            "installation_request.cancel.v1"
        ),
        entity="installation_requests",
        entity_id=before["id"],
        before=before,
        after=after,
    )

    return {
        "ok": True,
        "status": "cancelled",
        "idempotent": False,
        "request_id": before["id"],
        "reference": before[
            "reference"
        ],
        "cancelled_task_count": len(
            cancelled_task_ids
        ),
        "audit_id": audit_id,
    }
# ============================================================
# R9-P5-H4-A3 — customer order -> generic installation adapter
# ============================================================

@transaction.atomic
def ensure_customer_order_installation_request(
    *,
    actor_id: str,
    order_id: str,
    legacy_pending_installation_id: str,
    legacy_beacon_id: str,
) -> dict[str, Any]:
    """
    Mirror one paid physical customer order into the generic
    installation request/task model without replacing the legacy
    H2 preallocation workflow.

    Current payment fulfillment is one canonical site/item per
    order, therefore the generic request quantity is exactly 1.

    The generic task intentionally keeps beacon_id,
    assigned_agent_id and installation_id unset.  H4-A4 will own
    the real-stock/agent cutover.
    """

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                o.id,
                o.order_ref,
                o.customer_id,
                o.status,
                os.id AS order_site_id,
                os.sequence_no,
                os.place_name,
                CASE
                    WHEN os.requested_location IS NULL
                    THEN NULL
                    ELSE ST_Y(
                        os.requested_location::geometry
                    )
                END AS requested_lat,
                CASE
                    WHEN os.requested_location IS NULL
                    THEN NULL
                    ELSE ST_X(
                        os.requested_location::geometry
                    )
                END AS requested_lng,
                os.location_accuracy_m,
                os.commune_id,
                os.district_id,
                os.sector_id,
                os.address_line,
                os.access_point_note,
                pi.id AS pending_installation_id,
                pi.beacon_id AS legacy_beacon_id,
                pi.status AS legacy_pending_status,
                b.category AS beacon_category,
                pr.full_name AS customer_name,
                COALESCE(
                    pr.phone,
                    o.phone
                ) AS customer_phone
            FROM public.orders o
            JOIN public.order_sites os
              ON os.order_id = o.id
            JOIN public.pending_installations pi
              ON pi.order_id = o.id
            JOIN public.beacons b
              ON b.id = pi.beacon_id
            LEFT JOIN public.profiles pr
              ON pr.id = o.customer_id
            WHERE o.id = %s
            ORDER BY os.sequence_no
            FOR UPDATE OF o, os, pi, b
            """,
            [
                order_id,
            ],
        )

        rows = cursor.fetchall()

    if len(rows) != 1:
        raise GenericInstallationRequestStateError(
            "La commande physique doit exposer exactement un site "
            "et une pré-allocation legacy avant adaptation générique."
        )

    (
        selected_order_id,
        order_ref,
        customer_id,
        order_status,
        order_site_id,
        sequence_no,
        place_name,
        requested_lat,
        requested_lng,
        location_accuracy_m,
        commune_id,
        district_id,
        sector_id,
        address_line,
        access_point_note,
        selected_pending_installation_id,
        selected_legacy_beacon_id,
        legacy_pending_status,
        beacon_category,
        customer_name,
        customer_phone,
    ) = rows[0]

    if str(
        order_status
    ) != "paid":
        raise GenericInstallationRequestStateError(
            "L'adapter customer_order exige une commande payée."
        )

    if customer_id is None:
        raise GenericInstallationRequestValidationError(
            "La commande customer_order doit avoir un client."
        )

    if int(
        sequence_no
        or 0
    ) != 1:
        raise GenericInstallationRequestStateError(
            "Le site customer_order canonique doit avoir sequence_no = 1."
        )

    if requested_lat is None or requested_lng is None:
        raise GenericInstallationRequestValidationError(
            "La position GPS du site customer_order est obligatoire."
        )

    if commune_id is None:
        raise GenericInstallationRequestValidationError(
            "La commune du site customer_order est obligatoire."
        )

    clean_category = _clean_text(
        beacon_category,
        max_length=80,
    )

    if clean_category is None:
        raise GenericInstallationRequestValidationError(
            "La catégorie de balise legacy est absente."
        )

    if (
        str(
            selected_pending_installation_id
        )
        != str(
            legacy_pending_installation_id
        )
    ):
        raise GenericInstallationRequestStateError(
            "La pending_installation fournie ne correspond pas à la commande."
        )

    if (
        str(
            selected_legacy_beacon_id
        )
        != str(
            legacy_beacon_id
        )
    ):
        raise GenericInstallationRequestStateError(
            "La balise legacy fournie ne correspond pas à la pré-allocation."
        )

    if str(
        legacy_pending_status
    ) != "pending":
        raise GenericInstallationRequestStateError(
            "L'adapter customer_order ne crée une couche générique "
            "que pour une installation legacy encore pending."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                source_type
            FROM public.installation_requests
            WHERE order_id = %s
            ORDER BY created_at, id
            FOR UPDATE
            """,
            [
                selected_order_id,
            ],
        )

        existing_rows = cursor.fetchall()

    if len(
        existing_rows
    ) > 1:
        raise GenericInstallationRequestStateError(
            "Plusieurs demandes génériques existent pour la même commande."
        )

    mutated = False

    if existing_rows:
        request_id = str(
            existing_rows[0][0]
        )

        if str(
            existing_rows[0][1]
        ) != "customer_order":
            raise GenericInstallationRequestStateError(
                "La commande est déjà liée à une demande d'une autre origine."
            )

    else:
        created = create_installation_request(
            actor_id=actor_id,
            source_type="customer_order",
            source_reference=str(
                order_ref
            ),
            order_id=str(
                selected_order_id
            ),
            customer_id=str(
                customer_id
            ),
            title=(
                "Installation client — commande "
                + str(
                    order_ref
                )
            ),
            category=clean_category,
            quantity=1,
            commune_id=str(
                commune_id
            ),
            priority="normal",
            beneficiary_name=(
                str(
                    customer_name
                ).strip()
                if customer_name
                else None
            ),
            beneficiary_phone=(
                str(
                    customer_phone
                ).strip()
                if customer_phone
                else None
            ),
            reason=(
                "Commande physique payée — "
                "adaptation automatique vers le workflow générique."
            ),
            district_id=(
                str(
                    district_id
                )
                if district_id
                is not None
                else None
            ),
            sector_id=(
                str(
                    sector_id
                )
                if sector_id
                is not None
                else None
            ),
            requested_lat=float(
                requested_lat
            ),
            requested_lng=float(
                requested_lng
            ),
            location_accuracy_m=(
                float(
                    location_accuracy_m
                )
                if location_accuracy_m
                is not None
                else None
            ),
            address_line=(
                str(
                    address_line
                ).strip()
                if address_line
                else None
            ),
            access_point_note=(
                str(
                    access_point_note
                ).strip()
                if access_point_note
                else None
            ),
            metadata={
                "adapter": "customer_order.v1",
                "order_ref": str(
                    order_ref
                ),
                "order_site_id": str(
                    order_site_id
                ),
                "legacy_pending_installation_id": str(
                    selected_pending_installation_id
                ),
                "legacy_beacon_id_at_adapter": str(
                    selected_legacy_beacon_id
                ),
            },
        )

        request_id = created[
            "request_id"
        ]
        mutated = True

    request_row = _load_request_for_update(
        request_id=request_id,
    )

    if request_row is None:
        raise GenericInstallationRequestNotFoundError(
            "Demande customer_order introuvable après adaptation."
        )

    state = _request_state_payload(
        request_row
    )

    if state[
        "source_type"
    ] != "customer_order":
        raise GenericInstallationRequestStateError(
            "Origine générique customer_order incohérente."
        )

    if (
        state[
            "order_id"
        ]
        != str(
            selected_order_id
        )
    ):
        raise GenericInstallationRequestStateError(
            "order_id générique incohérent."
        )

    if state[
        "quantity"
    ] != 1:
        raise GenericInstallationRequestStateError(
            "Une commande physique actuelle doit produire exactement une tâche."
        )

    if state[
        "category"
    ] != clean_category:
        raise GenericInstallationRequestStateError(
            "Catégorie générique incohérente avec la pré-allocation legacy."
        )

    if (
        state[
            "commune_id"
        ]
        != str(
            commune_id
        )
    ):
        raise GenericInstallationRequestStateError(
            "Commune générique incohérente avec le site de commande."
        )

    if (
        state[
            "district_id"
        ]
        != (
            str(
                district_id
            )
            if district_id
            is not None
            else None
        )
    ):
        raise GenericInstallationRequestStateError(
            "District générique incohérent avec le site de commande."
        )

    if (
        state[
            "sector_id"
        ]
        != (
            str(
                sector_id
            )
            if sector_id
            is not None
            else None
        )
    ):
        raise GenericInstallationRequestStateError(
            "Secteur générique incohérent avec le site de commande."
        )

    status = state[
        "status"
    ]

    if status == "draft":
        submit_installation_request(
            request_id=request_id,
            actor_id=actor_id,
        )
        mutated = True
        status = "pending_approval"

    if status == "pending_approval":
        approve_installation_request(
            request_id=request_id,
            actor_id=actor_id,
        )
        mutated = True
        status = "approved"

    elif status == "approved":
        approve_installation_request(
            request_id=request_id,
            actor_id=actor_id,
        )

    elif status in {
        "in_progress",
        "completed",
    }:
        pass

    elif status == "cancelled":
        raise GenericInstallationRequestStateError(
            "Une commande payée ne peut pas être reliée à une "
            "demande générique annulée."
        )

    else:
        raise GenericInstallationRequestStateError(
            "Statut générique customer_order non pris en charge."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                sequence_no,
                source_order_site_id,
                status,
                beacon_id,
                assigned_agent_id,
                installation_id,
                category,
                commune_id,
                district_id,
                sector_id
            FROM public.installation_tasks
            WHERE request_id = %s
            ORDER BY sequence_no
            FOR UPDATE
            """,
            [
                request_id,
            ],
        )

        task_rows = cursor.fetchall()

    if len(
        task_rows
    ) != 1:
        raise GenericInstallationRequestStateError(
            "La demande customer_order doit contenir exactement une tâche."
        )

    (
        task_id,
        task_sequence_no,
        source_order_site_id,
        task_status,
        task_beacon_id,
        task_agent_id,
        task_installation_id,
        task_category,
        task_commune_id,
        task_district_id,
        task_sector_id,
    ) = task_rows[0]

    if int(
        task_sequence_no
    ) != 1:
        raise GenericInstallationRequestStateError(
            "La tâche customer_order doit avoir sequence_no = 1."
        )

    if str(
        task_category
    ) != clean_category:
        raise GenericInstallationRequestStateError(
            "Catégorie de tâche customer_order incohérente."
        )

    if str(
        task_commune_id
    ) != str(
        commune_id
    ):
        raise GenericInstallationRequestStateError(
            "Commune de tâche customer_order incohérente."
        )

    if (
        str(
            task_district_id
        )
        if task_district_id
        is not None
        else None
    ) != (
        str(
            district_id
        )
        if district_id
        is not None
        else None
    ):
        raise GenericInstallationRequestStateError(
            "District de tâche customer_order incohérent."
        )

    if (
        str(
            task_sector_id
        )
        if task_sector_id
        is not None
        else None
    ) != (
        str(
            sector_id
        )
        if sector_id
        is not None
        else None
    ):
        raise GenericInstallationRequestStateError(
            "Secteur de tâche customer_order incohérent."
        )

    if source_order_site_id is None:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE public.installation_tasks
                SET
                    source_order_site_id = %s,
                    metadata = COALESCE(
                        metadata,
                        '{}'::jsonb
                    ) || jsonb_build_object(
                        'adapter',
                        'customer_order.v1',
                        'order_ref',
                        %s,
                        'legacy_pending_installation_id',
                        %s,
                        'legacy_beacon_id_at_adapter',
                        %s
                    ),
                    updated_at = NOW()
                WHERE
                    id = %s
                    AND source_order_site_id IS NULL
                RETURNING id
                """,
                [
                    order_site_id,
                    str(
                        order_ref
                    ),
                    str(
                        selected_pending_installation_id
                    ),
                    str(
                        selected_legacy_beacon_id
                    ),
                    task_id,
                ],
            )

            linked = cursor.fetchone()

        if linked is None:
            raise GenericInstallationRequestStateError(
                "La tâche customer_order a été reliée concurremment."
            )

        _insert_audit(
            actor_id=actor_id,
            action=(
                "installation_request.customer_order_adapter.v1"
            ),
            entity="installation_requests",
            entity_id=request_id,
            before={
                "task_id": str(
                    task_id
                ),
                "source_order_site_id": None,
            },
            after={
                "task_id": str(
                    task_id
                ),
                "source_order_site_id": str(
                    order_site_id
                ),
                "legacy_pending_installation_id": str(
                    selected_pending_installation_id
                ),
                "legacy_beacon_id_at_adapter": str(
                    selected_legacy_beacon_id
                ),
            },
        )

        source_order_site_id = (
            order_site_id
        )
        mutated = True

    elif (
        str(
            source_order_site_id
        )
        != str(
            order_site_id
        )
    ):
        raise GenericInstallationRequestStateError(
            "La tâche générique est reliée à un autre order_site."
        )

    if status == "approved":
        if (
            task_beacon_id is not None
            or task_agent_id is not None
            or task_installation_id is not None
        ):
            raise GenericInstallationRequestStateError(
                "A3 ne doit affecter ni balise, ni agent, ni installation."
            )

        if str(
            task_status
        ) != "pending":
            raise GenericInstallationRequestStateError(
                "Une nouvelle tâche customer_order approuvée doit être pending."
            )

    return {
        "ok": True,
        "idempotent": not mutated,
        "request_id": request_id,
        "reference": state[
            "reference"
        ],
        "request_status": status,
        "task_id": str(
            task_id
        ),
        "task_status": str(
            task_status
        ),
        "source_order_site_id": str(
            source_order_site_id
        ),
        "legacy_pending_installation_id": str(
            selected_pending_installation_id
        ),
        "legacy_beacon_id": str(
            selected_legacy_beacon_id
        ),
    }
