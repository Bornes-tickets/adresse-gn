from __future__ import annotations

import re
from typing import Any

from django.db import connection


_TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{16}$")


def _mask_phone(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    if not normalized:
        return None
    if len(normalized) <= 6:
        return "•••"
    return normalized[:6] + "•••" + normalized[-3:]


def _derive_public_status(
    *,
    order_status: str,
    devis_demande: bool,
    fulfillment_kind: str,
    installation_status: str | None,
    address_active: bool,
) -> str:
    if order_status == "cancelled":
        return "cancelled"
    if order_status == "refunded":
        return "refunded"
    if address_active:
        return "active"
    if devis_demande:
        return "pending"
    if order_status != "paid":
        return "pending"
    if fulfillment_kind == "physical_installation":
        if installation_status == "done":
            return "installed"
        if installation_status == "planned":
            return "in_progress"
    return "confirmed"


def fetch_public_order_by_token(token: str) -> dict[str, Any] | None:
    clean_token = str(token or "").strip()
    if not _TOKEN_RE.fullmatch(clean_token):
        return None

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                o.id,
                o.order_ref,
                o.status,
                o.client_type,
                o.full_name,
                o.phone,
                o.address_line,
                o.quartier,
                o.formule_code,
                o.formule_label,
                COALESCE(o.prix_ttc, 0),
                o.payment_method,
                COALESCE(o.devis_demande, false),
                p.fulfillment_kind,
                pi.status,
                o.created_at,
                EXISTS (
                    SELECT 1
                    FROM public.addresses a
                    WHERE a.beacon_id = site.beacon_id
                      AND a.status = 'active'
                ) AS address_active
            FROM public.orders o
            JOIN public.cms_plans p
              ON p.id = o.plan_id
            LEFT JOIN LATERAL (
                SELECT os.beacon_id
                FROM public.order_sites os
                WHERE os.order_id = o.id
                ORDER BY os.sequence_no
                LIMIT 1
            ) site ON true
            LEFT JOIN LATERAL (
                SELECT pending.status
                FROM public.pending_installations pending
                WHERE pending.order_id = o.id
                ORDER BY pending.created_at DESC
                LIMIT 1
            ) pi ON true
            WHERE o.guest_token = %s
            LIMIT 1
            """,
            [clean_token],
        )
        row = cursor.fetchone()

    if row is None:
        return None

    (
        order_id,
        order_ref,
        order_status,
        client_type,
        full_name,
        phone,
        address_line,
        quartier,
        formule_code,
        formule_label,
        prix_ttc,
        payment_method,
        devis_demande,
        fulfillment_kind,
        installation_status,
        created_at,
        address_active,
    ) = row

    public_status = _derive_public_status(
        order_status=str(order_status),
        devis_demande=bool(devis_demande),
        fulfillment_kind=str(fulfillment_kind),
        installation_status=(
            str(installation_status) if installation_status is not None else None
        ),
        address_active=bool(address_active),
    )

    return {
        "id": str(order_id),
        "order_ref": str(order_ref),
        "status": public_status,
        "client_type": str(client_type) if client_type is not None else None,
        "full_name": str(full_name) if full_name is not None else None,
        "phone": _mask_phone(phone),
        "address_line": str(address_line) if address_line is not None else None,
        "quartier": str(quartier) if quartier is not None else None,
        "formule_code": str(formule_code) if formule_code is not None else None,
        "formule_label": str(formule_label) if formule_label is not None else None,
        "prix_ttc": int(prix_ttc or 0),
        "payment_method": str(payment_method) if payment_method is not None else None,
        "devis_demande": bool(devis_demande),
        "fulfillment_kind": str(fulfillment_kind),
        "installation_status": (
            str(installation_status) if installation_status is not None else None
        ),
        "created_at": created_at,
    }
