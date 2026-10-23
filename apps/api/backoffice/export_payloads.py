from __future__ import annotations

from typing import Any

from django.db import connection

from .action_common import ActionError


def qr_export_payload(
    lot_id: str,
    *,
    kind: str,
) -> dict[str, Any]:
    if kind not in {
        "qr_pdf",
        "qr_zip",
        "qr_csv",
    }:
        raise ActionError("Type d’export QR invalide.")

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT code
            FROM public.lots
            WHERE id = %s
            """,
            [lot_id],
        )
        lot = cursor.fetchone()
        if not lot:
            raise ActionError(
                "Lot introuvable.",
                status="not_found",
                http_status=404,
            )

        cursor.execute(
            """
            SELECT public_number
            FROM public.beacons
            WHERE lot_id = %s
            ORDER BY public_number
            LIMIT 600
            """,
            [lot_id],
        )
        numbers = [
            str(row[0])
            for row in cursor.fetchall()
        ]

    if not numbers:
        raise ActionError("Aucune balise dans ce lot.")

    return {
        "ok": True,
        "status": "export_ready",
        "client_export": {
            "kind": kind,
            "lot_code": str(lot[0]),
            "numbers": numbers,
        },
    }


def po_export_payload(lot_id: str) -> dict[str, Any]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                po.id::text,
                po.po_number,
                po.issued_at,
                po.expected_delivery,
                po.payment_terms,
                po.delivery_address,
                po.amount_ht,
                po.tva_rate,
                po.tva_amount,
                po.amount_ttc,
                po.currency,
                po.status,
                po.notes,
                po.supplier_snapshot,
                l.code AS lot_code
            FROM public.purchase_orders po
            LEFT JOIN public.lots l
              ON l.id = po.lot_id
            WHERE po.lot_id = %s
            ORDER BY po.created_at DESC
            LIMIT 1
            """,
            [lot_id],
        )
        header = cursor.fetchone()
        if not header:
            raise ActionError(
                "Bon de commande introuvable.",
                status="not_found",
                http_status=404,
            )

        cursor.execute(
            """
            SELECT
                designation,
                category,
                quantity,
                unit_price_ht,
                line_total_ht,
                position
            FROM public.purchase_order_lines
            WHERE po_id = %s
            ORDER BY position, id
            """,
            [header[0]],
        )
        line_rows = cursor.fetchall()

    return {
        "ok": True,
        "status": "export_ready",
        "client_export": {
            "kind": "po_pdf",
            "document": {
                "po_number": header[1],
                "issued_at": (
                    header[2].isoformat()
                    if header[2]
                    else None
                ),
                "expected_delivery": (
                    header[3].isoformat()
                    if header[3]
                    else None
                ),
                "payment_terms": header[4],
                "delivery_address": header[5],
                "amount_ht": int(header[6] or 0),
                "tva_rate": float(header[7] or 0),
                "tva_amount": int(header[8] or 0),
                "amount_ttc": int(header[9] or 0),
                "currency": header[10],
                "status": header[11],
                "notes": header[12],
                "supplier": header[13],
                "lot_code": header[14],
                "lines": [
                    {
                        "designation": row[0],
                        "category": row[1],
                        "quantity": row[2],
                        "unit_price_ht": row[3],
                        "line_total_ht": row[4],
                        "position": row[5],
                    }
                    for row in line_rows
                ],
            },
        },
    }


def dn_export_payload(lot_id: str) -> dict[str, Any]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                dn.dn_number,
                dn.shipped_at,
                dn.received_at,
                dn.carrier,
                dn.tracking_number,
                dn.quantity_ordered,
                dn.quantity_shipped,
                dn.quantity_received,
                dn.discrepancy,
                dn.qc_passed,
                dn.defects,
                dn.receiver_name,
                dn.notes,
                dn.supplier_snapshot,
                l.code AS lot_code,
                po.po_number
            FROM public.delivery_notes dn
            LEFT JOIN public.lots l
              ON l.id = dn.lot_id
            LEFT JOIN public.purchase_orders po
              ON po.id = dn.po_id
            WHERE dn.lot_id = %s
            ORDER BY dn.created_at DESC
            LIMIT 1
            """,
            [lot_id],
        )
        row = cursor.fetchone()

    if not row:
        raise ActionError(
            "Bon de livraison introuvable.",
            status="not_found",
            http_status=404,
        )

    return {
        "ok": True,
        "status": "export_ready",
        "client_export": {
            "kind": "dn_pdf",
            "document": {
                "dn_number": row[0],
                "shipped_at": row[1].isoformat() if row[1] else None,
                "received_at": row[2].isoformat() if row[2] else None,
                "carrier": row[3],
                "tracking_number": row[4],
                "quantity_ordered": row[5],
                "quantity_shipped": row[6],
                "quantity_received": row[7],
                "discrepancy": row[8],
                "qc_passed": row[9],
                "defects": row[10],
                "receiver_name": row[11],
                "notes": row[12],
                "supplier": row[13],
                "lot_code": row[14],
                "po_number": row[15],
            },
        },
    }
