from __future__ import annotations

import os
from typing import Any
from uuid import uuid4

from django.db import connection, transaction


class PaymentError(Exception):
    code = "PAYMENT_ERROR"


class PaymentOrderNotFoundError(PaymentError):
    code = "ORDER_NOT_FOUND"


class PaymentOrderNotPayableError(PaymentError):
    code = "ORDER_NOT_PAYABLE"


class PaymentAlreadyPaidError(PaymentError):
    code = "ORDER_ALREADY_PAID"


def _dict_one(cursor) -> dict[str, Any] | None:
    row = cursor.fetchone()

    if row is None:
        return None

    columns = [
        column.name
        for column in cursor.description
    ]

    return dict(
        zip(columns, row)
    )


def payment_methods() -> list[dict[str, Any]]:
    return [
        {
            "code": "manual",
            "label": "Paiement manuel",
            "enabled": True,
            "description": (
                "Paiement par espèces ou virement, "
                "puis validation par l'équipe Adresse GN."
            ),
        },
        {
            "code": "orange",
            "label": "Orange Money",
            "enabled": False,
            "description": "Activation fournisseur différée.",
        },
        {
            "code": "mtn",
            "label": "MTN Mobile Money",
            "enabled": False,
            "description": "Activation fournisseur différée.",
        },
    ]


def _load_owned_order(
    *,
    user_id: str,
    order_ref: str,
    for_update: bool = False,
) -> dict[str, Any]:
    lock = (
        " FOR UPDATE"
        if for_update
        else ""
    )

    with connection.cursor() as cursor:
        cursor.execute(
            (
                """
                SELECT
                    o.id,
                    o.order_ref,
                    o.customer_id,
                    o.offer_code,
                    o.amount_gnf,
                    o.status,
                    o.items,
                    o.payment_method,
                    o.devis_demande,
                    o.created_at
                FROM public.orders o
                WHERE
                    o.order_ref = %s
                    AND o.customer_id = %s
                LIMIT 1
                """
                + lock
            ),
            [
                order_ref,
                user_id,
            ],
        )

        order = _dict_one(cursor)

    if order is None:
        raise PaymentOrderNotFoundError(
            "Commande introuvable."
        )

    return order


def _latest_payment(
    order_id: str,
) -> dict[str, Any] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                provider,
                status,
                external_ref,
                amount_gnf,
                paid_at,
                created_at
            FROM public.payments
            WHERE order_id = %s
            ORDER BY
                created_at DESC,
                id DESC
            LIMIT 1
            """,
            [order_id],
        )

        return _dict_one(cursor)


def _latest_invoice(
    order_id: str,
) -> dict[str, Any] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                number,
                pdf_url,
                status,
                issued_at
            FROM public.invoices
            WHERE order_id = %s
            ORDER BY
                issued_at DESC NULLS LAST,
                id DESC
            LIMIT 1
            """,
            [order_id],
        )

        return _dict_one(cursor)


def get_payment_order(
    *,
    user_id: str,
    order_ref: str,
) -> dict[str, Any]:
    order = _load_owned_order(
        user_id=user_id,
        order_ref=order_ref,
    )

    return {
        "id": str(order["id"]),
        "order_ref": str(order["order_ref"]),
        "offer_code": order["offer_code"],
        "amount_gnf": int(
            order["amount_gnf"]
            or 0
        ),
        "status": order["status"],
        "items": order["items"] or [],
        "payment_method": order["payment_method"],
        "devis_demande": bool(
            order["devis_demande"]
        ),
        "created_at": order["created_at"],
        "payment": _latest_payment(
            str(order["id"])
        ),
        "invoice": _latest_invoice(
            str(order["id"])
        ),
    }


def _manual_action(
    *,
    order_ref: str,
    amount_gnf: int,
) -> dict[str, Any]:
    whatsapp = str(
        os.environ.get(
            "MANUAL_WHATSAPP_NUMBER",
            "",
        )
        or ""
    ).strip()

    instructions = (
        "Votre demande de paiement manuel est enregistrée. "
        f"Référence : {order_ref}. "
        f"Montant : {amount_gnf:,} GNF. "
        "Le règlement peut être finalisé par espèces ou virement. "
        "Conservez la référence de commande pour la validation."
    ).replace(
        ",",
        " ",
    )

    return {
        "type": "manual",
        "instructions": instructions,
        "whatsapp_number": (
            whatsapp
            if whatsapp
            else None
        ),
    }


@transaction.atomic
def initiate_manual_payment(
    *,
    user_id: str,
    order_ref: str,
) -> dict[str, Any]:
    order = _load_owned_order(
        user_id=user_id,
        order_ref=order_ref,
        for_update=True,
    )

    if bool(
        order["devis_demande"]
    ):
        raise PaymentOrderNotPayableError(
            "Cette commande est sur devis."
        )

    amount_gnf = int(
        order["amount_gnf"]
        or 0
    )

    if amount_gnf <= 0:
        raise PaymentOrderNotPayableError(
            "Cette commande n'a pas de montant payable."
        )

    order_status = str(
        order["status"]
        or ""
    )

    if order_status == "paid":
        raise PaymentAlreadyPaidError(
            "Cette commande est déjà payée."
        )

    if order_status != "pending":
        raise PaymentOrderNotPayableError(
            "Cette commande ne peut pas être payée dans son état actuel."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                provider,
                status,
                external_ref,
                amount_gnf,
                paid_at,
                created_at
            FROM public.payments
            WHERE
                order_id = %s
                AND provider = 'manual'
                AND status = 'pending'
            ORDER BY
                created_at DESC,
                id DESC
            LIMIT 1
            """,
            [order["id"]],
        )

        existing = _dict_one(cursor)

        created = False

        if existing is None:
            intent_id = (
                f"manual_{order_ref}_"
                f"{uuid4().hex[:12]}"
            )

            cursor.execute(
                """
                INSERT INTO public.payments (
                    order_id,
                    provider,
                    amount_gnf,
                    status,
                    intent_id
                )
                VALUES (
                    %s,
                    'manual',
                    %s,
                    'pending',
                    %s
                )
                RETURNING
                    id,
                    provider,
                    status,
                    external_ref,
                    amount_gnf,
                    paid_at,
                    created_at
                """,
                [
                    order["id"],
                    amount_gnf,
                    intent_id,
                ],
            )

            existing = _dict_one(cursor)
            created = True

    if existing is None:
        raise PaymentError(
            "Impossible d'initialiser le paiement manuel."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE public.orders
            SET payment_method = 'manual'
            WHERE
                id = %s
                AND payment_method IS DISTINCT FROM 'manual'
            """,
            [order["id"]],
        )

    return {
        "payment": existing,
        "created": created,
        "action": _manual_action(
            order_ref=str(
                order["order_ref"]
            ),
            amount_gnf=amount_gnf,
        ),
    }


class SalesPaymentError(PaymentError):
    code = "SALES_PAYMENT_ERROR"


class SalesPaymentNotFoundError(SalesPaymentError):
    code = "PAYMENT_NOT_FOUND"


class SalesPaymentStateError(SalesPaymentError):
    code = "PAYMENT_STATE_INVALID"


def list_sales_payments(
    *,
    status_filter: str = "pending",
    page: int = 1,
    page_size: int = 25,
) -> dict[str, Any]:
    allowed_statuses = {
        "all",
        "pending",
        "success",
        "failed",
        "refunded",
        "actionable",
    }

    normalized_status = str(
        status_filter or "pending"
    ).strip().lower()

    if normalized_status not in allowed_statuses:
        raise SalesPaymentStateError(
            "Statut de paiement invalide."
        )

    safe_page = max(1, int(page or 1))
    safe_page_size = min(100, max(1, int(page_size or 25)))
    offset = (safe_page - 1) * safe_page_size
    params: list[Any] = []

    if normalized_status == "actionable":
        where = """
        WHERE
            p.provider = 'manual'
            AND (
                p.status = 'pending'
                OR (
                    p.status = 'success'
                    AND (
                        i.id IS NULL
                        OR NULLIF(
                            BTRIM(COALESCE(i.pdf_url, '')),
                            ''
                        ) IS NULL
                    )
                )
            )
        """
    elif normalized_status == "all":
        where = ""
    else:
        where = "WHERE p.status = %s"
        params.append(normalized_status)

    from_sql = """
        FROM public.payments p
        JOIN public.orders o
          ON o.id = p.order_id
        LEFT JOIN public.profiles pr
          ON pr.id = o.customer_id
        LEFT JOIN public.invoices i
          ON i.order_id = o.id
    """

    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT COUNT(*)
            {from_sql}
            {where}
            """,
            params,
        )
        total = int(cursor.fetchone()[0])

        cursor.execute(
            f"""
            SELECT
                p.id,
                p.provider,
                p.status,
                p.amount_gnf,
                p.external_ref,
                p.paid_at,
                p.created_at,
                o.order_ref,
                o.offer_code,
                o.status AS order_status,
                o.created_at AS order_created_at,
                o.notes,
                pr.full_name,
                pr.phone,
                i.id AS invoice_id,
                i.number AS invoice_number,
                i.pdf_url AS invoice_pdf_url,
                CASE
                    WHEN p.provider = 'manual'
                         AND p.status = 'pending'
                        THEN 'pending_confirmation'
                    WHEN p.provider = 'manual'
                         AND p.status = 'success'
                         AND i.id IS NULL
                        THEN 'db_pending_retry'
                    WHEN p.provider = 'manual'
                         AND p.status = 'success'
                         AND i.id IS NOT NULL
                         AND NULLIF(
                             BTRIM(COALESCE(i.pdf_url, '')),
                             ''
                         ) IS NULL
                        THEN 'storage_pending_retry'
                    WHEN p.provider = 'manual'
                         AND p.status = 'success'
                         AND NULLIF(
                             BTRIM(COALESCE(i.pdf_url, '')),
                             ''
                         ) IS NOT NULL
                        THEN 'published'
                    ELSE NULL
                END AS invoice_state
            {from_sql}
            {where}
            ORDER BY
                p.created_at DESC,
                p.id DESC
            LIMIT %s
            OFFSET %s
            """,
            [*params, safe_page_size, offset],
        )
        rows = cursor.fetchall()

    items = [
        {
            "id": str(row[0]),
            "provider": row[1],
            "status": row[2],
            "amount_gnf": int(row[3] or 0),
            "external_ref": row[4],
            "paid_at": row[5],
            "payment_created_at": row[6],
            "order_ref": row[7],
            "offer_code": row[8],
            "order_status": row[9],
            "order_created_at": row[10],
            "notes": row[11],
            "client": row[12] or "Client",
            "client_phone": row[13],
            "invoice_id": str(row[14]) if row[14] is not None else None,
            "invoice_number": row[15],
            "invoice_pdf_url": row[16],
            "invoice_state": row[17],
        }
        for row in rows
    ]

    return {
        "total": total,
        "page": safe_page,
        "page_size": safe_page_size,
        "items": items,
    }

@transaction.atomic
def reject_manual_payment(
    *,
    actor_id: str,
    payment_id: str,
    reason: str,
) -> dict[str, Any]:
    clean_reason = str(
        reason or ""
    ).strip()

    if len(clean_reason) < 3:
        raise SalesPaymentStateError(
            "Motif de rejet obligatoire."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                p.id,
                p.order_id,
                p.provider,
                p.status,
                o.customer_id,
                o.order_ref
            FROM public.payments p
            JOIN public.orders o
              ON o.id = p.order_id
            WHERE p.id = %s
            FOR UPDATE OF p, o
            """,
            [payment_id],
        )

        row = cursor.fetchone()

        if row is None:
            raise SalesPaymentNotFoundError(
                "Paiement introuvable."
            )

        (
            selected_payment_id,
            order_id,
            provider,
            payment_status,
            customer_id,
            order_ref,
        ) = row

        if payment_status != "pending":
            raise SalesPaymentStateError(
                "Ce paiement n'est plus en attente."
            )

        if provider != "manual":
            raise SalesPaymentStateError(
                "Seuls les paiements manuels peuvent être rejetés dans cette phase."
            )

        cursor.execute(
            """
            UPDATE public.payments
            SET status = 'failed'
            WHERE id = %s
            """,
            [selected_payment_id],
        )

        cursor.execute(
            """
            UPDATE public.orders
            SET
                status = 'cancelled',
                notes = %s
            WHERE id = %s
            """,
            [
                clean_reason,
                order_id,
            ],
        )

        notification_id = None

        if customer_id is not None:
            cursor.execute(
                """
                INSERT INTO public.notifications (
                    user_id,
                    type,
                    payload
                )
                VALUES (
                    %s,
                    'payment_rejected',
                    jsonb_build_object(
                        'order_ref',
                        %s,
                        'motif',
                        %s,
                        'message',
                        %s
                    )
                )
                RETURNING id
                """,
                [
                    customer_id,
                    order_ref,
                    clean_reason,
                    (
                        "Votre paiement pour la commande "
                        f"{order_ref} n'a pas pu être validé : "
                        f"{clean_reason}"
                    ),
                ],
            )

            notification_id = (
                cursor.fetchone()[0]
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
                'payment.reject',
                'payments',
                %s,
                jsonb_build_object(
                    'motif',
                    %s,
                    'order_ref',
                    %s
                )
            )
            RETURNING id
            """,
            [
                actor_id,
                selected_payment_id,
                clean_reason,
                order_ref,
            ],
        )

        audit_id = cursor.fetchone()[0]

    return {
        "ok": True,
        "payment_id": str(
            selected_payment_id
        ),
        "order_ref": str(
            order_ref
        ),
        "notification_id": (
            str(notification_id)
            if notification_id is not None
            else None
        ),
        "audit_id": str(
            audit_id
        ),
    }


# ============================================================
# PHASE 15G2B8-R1 — confirmation manuelle / fulfillment DB core
# ============================================================

class SalesPaymentConfirmError(SalesPaymentError):
    code = "PAYMENT_CONFIRM_ERROR"


class SalesPaymentConfirmStateError(SalesPaymentConfirmError):
    code = "PAYMENT_CONFIRM_STATE_INVALID"


class SalesPaymentFulfillmentError(SalesPaymentConfirmError):
    code = "PAYMENT_FULFILLMENT_INVALID"


_ADDRESS_CATEGORY_BY_PLACE_TYPE = {
    "residential": "habitation",
    "business": "commerce",
    "company": "entreprise",
    "other": "other",
}

_CANONICAL_FULFILLMENTS = {
    "digital_address",
    "physical_installation",
}


def _normalize_order_items(
    value: Any,
) -> list[dict[str, Any]]:
    candidate = value

    if isinstance(candidate, str):
        try:
            candidate = __import__("json").loads(
                candidate
            )
        except (TypeError, ValueError):
            return []

    if isinstance(candidate, tuple):
        candidate = list(candidate)

    if isinstance(candidate, list):
        return [
            item
            for item in candidate
            if isinstance(item, dict)
        ]

    return []


def _validate_fulfillment_items(
    *,
    items: Any,
    fulfillment_kind: str,
) -> list[dict[str, Any]]:
    normalized = _normalize_order_items(
        items
    )

    if not normalized:
        raise SalesPaymentFulfillmentError(
            "La commande ne contient aucun item canonique."
        )

    for item in normalized:
        item_kind = str(
            item.get("fulfillment_kind")
            or ""
        ).strip()

        if item_kind != fulfillment_kind:
            raise SalesPaymentFulfillmentError(
                "Le fulfillment des items ne correspond pas au plan."
            )

        qty = int(
            item.get("qty")
            or 0
        )

        if qty != 1:
            raise SalesPaymentFulfillmentError(
                "15G2B8 ne prend en charge qu'un site par commande."
            )

    if len(normalized) != 1:
        raise SalesPaymentFulfillmentError(
            "15G2B8 ne prend en charge qu'un item canonique par commande."
        )

    return normalized


def _load_confirmation_result(
    *,
    order_id: str,
    fulfillment_kind: str,
) -> dict[str, Any]:
    if fulfillment_kind == "digital_address":
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    b.id,
                    b.public_number,
                    a.id
                FROM public.orders o
                JOIN public.beacons b
                  ON b.id = o.beacon_id
                JOIN public.addresses a
                  ON a.beacon_id = b.id
                WHERE o.id = %s
                LIMIT 1
                """,
                [order_id],
            )

            row = cursor.fetchone()

        if row is None:
            raise SalesPaymentConfirmStateError(
                "Paiement déjà confirmé mais adresse numérique introuvable."
            )

        return {
            "fulfillment_kind": "digital_address",
            "beacon_id": str(row[0]),
            "public_number": str(row[1]),
            "address_id": str(row[2]),
        }

    if fulfillment_kind == "physical_installation":
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id
                FROM public.pending_installations
                WHERE order_id = %s
                LIMIT 1
                """,
                [order_id],
            )

            row = cursor.fetchone()

        if row is None:
            raise SalesPaymentConfirmStateError(
                "Paiement déjà confirmé mais installation à planifier introuvable."
            )

        return {
            "fulfillment_kind": "physical_installation",
            "pending_installation_id": str(row[0]),
        }

    raise SalesPaymentFulfillmentError(
        "Fulfillment non pris en charge."
    )


def _lock_single_order_site(
    *,
    order_id: str,
) -> dict[str, Any]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                sequence_no,
                place_type,
                place_name,
                requested_location,
                location_accuracy_m,
                commune_id,
                district_id,
                sector_id,
                address_line,
                access_point_note,
                beacon_id,
                status
            FROM public.order_sites
            WHERE order_id = %s
            ORDER BY sequence_no
            FOR UPDATE
            """,
            [order_id],
        )

        rows = cursor.fetchall()

        if len(rows) != 1:
            raise SalesPaymentFulfillmentError(
                "La commande doit contenir exactement un site."
            )

        columns = [
            column.name
            for column in cursor.description
        ]

    return dict(
        zip(
            columns,
            rows[0],
        )
    )


def _resolve_site_region(
    *,
    commune_id,
) -> dict[str, Any]:
    if commune_id is None:
        raise SalesPaymentFulfillmentError(
            "La commune est obligatoire avant confirmation."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                c.id,
                c.is_active,
                r.id,
                r.code
            FROM public.communes c
            JOIN public.regions r
              ON r.id = c.region_id
            WHERE c.id = %s
            LIMIT 1
            """,
            [commune_id],
        )

        row = cursor.fetchone()

    if row is None:
        raise SalesPaymentFulfillmentError(
            "Commune ou région introuvable."
        )

    if not bool(row[1]):
        raise SalesPaymentFulfillmentError(
            "La commune sélectionnée est inactive."
        )

    region_code = str(
        row[3]
        or ""
    ).strip().upper()[:3]

    if not region_code:
        raise SalesPaymentFulfillmentError(
            "Code région absent."
        )

    return {
        "commune_id": row[0],
        "region_id": row[2],
        "region_code": region_code,
    }


def _next_virtual_beacon_number(
    *,
    region_code: str,
) -> str:
    prefix = (
        f"GN-{region_code}-"
    )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT pg_advisory_xact_lock(
                hashtext(%s)
            )
            """,
            [
                f"adresse-gn:{prefix}",
            ],
        )

        cursor.execute(
            """
            SELECT MAX(
                RIGHT(public_number, 6)::integer
            )
            FROM public.beacons
            WHERE
                public_number LIKE %s
                AND public_number ~ %s
            """,
            [
                f"{prefix}%",
                (
                    "^"
                    + prefix
                    + "[0-9]{6}$"
                ),
            ],
        )

        max_suffix = cursor.fetchone()[0]

    next_suffix = (
        int(max_suffix) + 1
        if max_suffix is not None
        else 100011
    )

    if next_suffix > 999999:
        raise SalesPaymentFulfillmentError(
            "Plage de numérotation régionale épuisée."
        )

    return (
        f"{prefix}"
        f"{next_suffix:06d}"
    )


def _fulfill_digital_address(
    *,
    order_id,
    order_ref: str,
    customer_id,
    site: dict[str, Any],
    region_code: str,
) -> dict[str, Any]:
    if site["requested_location"] is None:
        raise SalesPaymentFulfillmentError(
            "La position GPS est obligatoire avant confirmation."
        )

    if site["beacon_id"] is not None:
        raise SalesPaymentFulfillmentError(
            "Le site possède déjà une balise."
        )

    public_number = _next_virtual_beacon_number(
        region_code=region_code
    )

    place_type = str(
        site.get("place_type")
        or "other"
    ).strip().lower()

    address_category = (
        _ADDRESS_CATEGORY_BY_PLACE_TYPE.get(
            place_type,
            "other",
        )
    )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO public.beacons (
                public_number,
                status,
                category,
                lot_id,
                activated_at
            )
            VALUES (
                %s,
                'active',
                'digital_only',
                NULL,
                NOW()
            )
            RETURNING id
            """,
            [public_number],
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
                district_id
            )
            SELECT
                %s,
                %s,
                %s,
                s.place_name,
                s.requested_location,
                s.location_accuracy_m,
                'private',
                'pending',
                s.access_point_note,
                'active',
                s.commune_id,
                s.district_id
            FROM public.order_sites s
            WHERE s.id = %s
            RETURNING id
            """,
            [
                beacon_id,
                customer_id,
                address_category,
                site["id"],
            ],
        )

        address_row = cursor.fetchone()

        if address_row is None:
            raise SalesPaymentFulfillmentError(
                "Création de l'adresse numérique impossible."
            )

        address_id = address_row[0]

        cursor.execute(
            """
            UPDATE public.orders
            SET beacon_id = %s
            WHERE id = %s
            """,
            [
                beacon_id,
                order_id,
            ],
        )

        cursor.execute(
            """
            UPDATE public.order_sites
            SET beacon_id = %s
            WHERE id = %s
            """,
            [
                beacon_id,
                site["id"],
            ],
        )

    return {
        "fulfillment_kind": "digital_address",
        "beacon_id": str(beacon_id),
        "public_number": public_number,
        "address_id": str(address_id),
    }


def _fulfill_physical_installation(
    *,
    order_id,
    order_ref: str,
    customer_id,
    customer_phone: str | None,
) -> dict[str, Any]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id
            FROM public.pending_installations
            WHERE order_id = %s
            LIMIT 1
            """,
            [order_id],
        )

        existing = cursor.fetchone()

        if existing is not None:
            pending_id = existing[0]
        else:
            cursor.execute(
                """
                INSERT INTO public.pending_installations (
                    beacon_id,
                    order_id,
                    customer_id,
                    phone,
                    note,
                    status
                )
                VALUES (
                    NULL,
                    %s,
                    %s,
                    %s,
                    %s,
                    'pending'
                )
                RETURNING id
                """,
                [
                    order_id,
                    customer_id,
                    customer_phone,
                    (
                        "Installation Adresse GN à planifier — "
                        f"commande {order_ref}"
                    ),
                ],
            )

            pending_id = cursor.fetchone()[0]

    return {
        "fulfillment_kind": "physical_installation",
        "pending_installation_id": str(pending_id),
    }


@transaction.atomic
def confirm_manual_payment_core(
    *,
    actor_id: str,
    payment_id: str,
    external_ref: str,
    note: str | None = None,
) -> dict[str, Any]:
    clean_external_ref = str(
        external_ref
        or ""
    ).strip()

    clean_note = (
        str(note).strip()
        if note is not None
        else None
    )

    if not clean_external_ref:
        raise SalesPaymentConfirmStateError(
            "Référence de règlement obligatoire."
        )

    if len(clean_external_ref) > 200:
        raise SalesPaymentConfirmStateError(
            "Référence de règlement trop longue."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                p.id,
                p.order_id,
                p.provider,
                p.status AS payment_status,
                p.amount_gnf AS payment_amount_gnf,
                p.external_ref,
                o.order_ref,
                o.customer_id,
                o.status AS order_status,
                o.amount_gnf AS order_amount_gnf,
                o.items,
                o.devis_demande,
                o.beacon_id,
                o.phone AS order_phone,
                cp.code AS plan_code,
                cp.requires_quote,
                to_jsonb(cp) ->> 'fulfillment_kind'
                    AS fulfillment_kind,
                pr.phone AS profile_phone
            FROM public.payments p
            JOIN public.orders o
              ON o.id = p.order_id
            LEFT JOIN public.cms_plans cp
              ON cp.id = o.plan_id
            LEFT JOIN public.profiles pr
              ON pr.id = o.customer_id
            WHERE p.id = %s
            FOR UPDATE OF p, o
            """,
            [payment_id],
        )

        row = _dict_one(cursor)

    if row is None:
        raise SalesPaymentNotFoundError(
            "Paiement introuvable."
        )

    if row["provider"] != "manual":
        raise SalesPaymentConfirmStateError(
            "Seuls les paiements manuels sont confirmables dans 15G2B8."
        )

    fulfillment_kind = str(
        row["fulfillment_kind"]
        or ""
    ).strip()

    if row["payment_status"] == "success":
        if row["order_status"] != "paid":
            raise SalesPaymentConfirmStateError(
                "Paiement confirmé mais commande non payée : état incohérent."
            )

        existing_fulfillment = _load_confirmation_result(
            order_id=str(row["order_id"]),
            fulfillment_kind=fulfillment_kind,
        )

        return {
            "ok": True,
            "idempotent": True,
            "payment_id": str(row["id"]),
            "order_ref": str(row["order_ref"]),
            "external_ref": row["external_ref"],
            "fulfillment": existing_fulfillment,
        }

    if row["payment_status"] != "pending":
        raise SalesPaymentConfirmStateError(
            "Ce paiement n'est plus en attente."
        )

    if row["customer_id"] is None:
        raise SalesPaymentFulfillmentError(
            "Commande sans customer_id : confirmation interdite."
        )

    if row["order_status"] != "pending":
        raise SalesPaymentConfirmStateError(
            "La commande n'est plus en attente."
        )

    if bool(row["devis_demande"]):
        raise SalesPaymentFulfillmentError(
            "Une commande sur devis ne peut pas être confirmée ici."
        )

    if fulfillment_kind not in _CANONICAL_FULFILLMENTS:
        raise SalesPaymentFulfillmentError(
            "Fulfillment non canonique ou historique : confirmation interdite."
        )

    payment_amount = int(
        row["payment_amount_gnf"]
        or 0
    )

    order_amount = int(
        row["order_amount_gnf"]
        or 0
    )

    if (
        payment_amount <= 0
        or order_amount <= 0
        or payment_amount != order_amount
    ):
        raise SalesPaymentConfirmStateError(
            "Le montant du paiement ne correspond pas à la commande."
        )

    _validate_fulfillment_items(
        items=row["items"],
        fulfillment_kind=fulfillment_kind,
    )

    site = _lock_single_order_site(
        order_id=str(row["order_id"])
    )

    if site["requested_location"] is None:
        raise SalesPaymentFulfillmentError(
            "La position GPS est obligatoire avant confirmation."
        )

    region = _resolve_site_region(
        commune_id=site["commune_id"]
    )

    if fulfillment_kind == "digital_address":
        if row["beacon_id"] is not None:
            raise SalesPaymentFulfillmentError(
                "La commande possède déjà une balise."
            )

        fulfillment = _fulfill_digital_address(
            order_id=row["order_id"],
            order_ref=str(row["order_ref"]),
            customer_id=row["customer_id"],
            site=site,
            region_code=str(region["region_code"]),
        )

    else:
        fulfillment = _fulfill_physical_installation(
            order_id=row["order_id"],
            order_ref=str(row["order_ref"]),
            customer_id=row["customer_id"],
            customer_phone=(
                row["profile_phone"]
                or row["order_phone"]
            ),
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE public.payments
            SET
                status = 'success',
                external_ref = %s,
                confirmed_by = %s,
                confirmed_at = NOW(),
                paid_at = NOW()
            WHERE id = %s
            """,
            [
                clean_external_ref,
                actor_id,
                row["id"],
            ],
        )

        cursor.execute(
            """
            UPDATE public.orders
            SET
                status = 'paid',
                notes = CASE
                    WHEN %s IS NULL OR %s = ''
                    THEN notes
                    ELSE %s
                END
            WHERE id = %s
            """,
            [
                clean_note,
                clean_note,
                clean_note,
                row["order_id"],
            ],
        )

        cursor.execute(
            """
            INSERT INTO public.notifications (
                user_id,
                type,
                payload
            )
            VALUES (
                %s,
                'payment_confirmed',
                jsonb_build_object(
                    'order_ref',
                    %s,
                    'fulfillment_kind',
                    %s,
                    'message',
                    %s
                )
            )
            RETURNING id
            """,
            [
                row["customer_id"],
                row["order_ref"],
                fulfillment_kind,
                (
                    "Votre paiement a été confirmé. "
                    "Le traitement de votre commande Adresse GN est en cours."
                ),
            ],
        )

        notification_id = cursor.fetchone()[0]

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
                'payment.confirm.core',
                'payments',
                %s,
                jsonb_build_object(
                    'order_ref',
                    %s,
                    'external_ref',
                    %s,
                    'fulfillment_kind',
                    %s,
                    'fulfillment',
                    %s::jsonb
                )
            )
            RETURNING id
            """,
            [
                actor_id,
                row["id"],
                row["order_ref"],
                clean_external_ref,
                fulfillment_kind,
                __import__("json").dumps(
                    fulfillment
                ),
            ],
        )

        audit_id = cursor.fetchone()[0]

    return {
        "ok": True,
        "idempotent": False,
        "payment_id": str(row["id"]),
        "order_ref": str(row["order_ref"]),
        "external_ref": clean_external_ref,
        "fulfillment": fulfillment,
        "notification_id": str(notification_id),
        "audit_id": str(audit_id),
    }


# ============================================================
# PHASE 15G2B11 — manual confirmation + invoice orchestration
# ============================================================

class ManualPaymentInvoiceOrchestrationError(RuntimeError):
    pass


def _confirmed_manual_payment_order_id(
    *,
    payment_id: str,
) -> str:
    from django.db import connection

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                p.order_id,
                p.provider,
                p.status,
                o.status
            FROM public.payments p
            JOIN public.orders o
              ON o.id = p.order_id
            WHERE p.id = %s
            LIMIT 1
            """,
            [payment_id],
        )

        row = cursor.fetchone()

    if row is None:
        raise ManualPaymentInvoiceOrchestrationError(
            "Paiement introuvable après confirmation."
        )

    order_id, provider, payment_status, order_status = row

    if str(provider) != "manual":
        raise ManualPaymentInvoiceOrchestrationError(
            "Le paiement confirmé n'est pas manuel."
        )

    if (
        str(payment_status) != "success"
        or str(order_status) != "paid"
    ):
        raise ManualPaymentInvoiceOrchestrationError(
            "Etat paiement/commande incohérent après confirmation."
        )

    return str(order_id)


def confirm_manual_payment_with_invoice(
    *,
    actor_id: str,
    payment_id: str,
    external_ref: str,
    note: str | None = None,
) -> dict:
    """
    Orchestration de production non exposée publiquement.

    Ordre volontaire :
    1) garde identité légale,
    2) confirmation + fulfillment B8,
    3) facture DB B9E,
    4) publication PDF/Storage B9E.

    Une erreur de publication Storage ne remet jamais en cause
    le paiement déjà confirmé ni le fulfillment déjà réalisé.
    Le même appel peut être rejoué : B8, la facture DB et la
    publication sont idempotents.
    """
    from .invoices import (
        prepare_paid_invoice_record,
        publish_invoice_pdf,
        require_invoice_legal_identity,
    )

    # Important : bloquer AVANT de confirmer le paiement si
    # l'identité légale n'est pas configurée.
    require_invoice_legal_identity()

    confirmation = confirm_manual_payment_core(
        actor_id=actor_id,
        payment_id=payment_id,
        external_ref=external_ref,
        note=note,
    )

    order_id = _confirmed_manual_payment_order_id(
        payment_id=payment_id
    )

    try:
        invoice = prepare_paid_invoice_record(
            order_id=order_id
        )
    except RuntimeError as exc:
        return {
            "ok": True,
            "payment_confirmed": True,
            "order_id": order_id,
            "confirmation": confirmation,
            "invoice_state": "db_pending_retry",
            "invoice": None,
            "publication": None,
            "invoice_error": str(exc)[:500],
        }

    try:
        publication = publish_invoice_pdf(
            invoice_id=invoice["id"]
        )
    except RuntimeError as exc:
        return {
            "ok": True,
            "payment_confirmed": True,
            "order_id": order_id,
            "confirmation": confirmation,
            "invoice_state": "storage_pending_retry",
            "invoice": invoice,
            "publication": None,
            "invoice_error": str(exc)[:500],
        }

    return {
        "ok": True,
        "payment_confirmed": True,
        "order_id": order_id,
        "confirmation": confirmation,
        "invoice_state": "published",
        "invoice": invoice,
        "publication": publication,
        "invoice_error": None,
    }
