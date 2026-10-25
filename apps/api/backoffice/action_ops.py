from __future__ import annotations

import json
from decimal import Decimal
from typing import Any

from django.db import connection, transaction

from .action_common import (
    ActionError,
    audit,
    bool_value,
    decimal_value,
    int_value,
    next_db_number,
    optional_text,
    required_text,
)


LOT_STATUSES = {
    "draft", "sent", "in_production", "shipped", "received",
    "generated", "distributed", "ordered", "in_use", "depleted", "recalled",
}
PO_STATUSES = {"draft", "sent", "acknowledged", "cancelled"}
PAYMENT_METHODS = {"bank_transfer", "cash", "check", "mobile_money", "other"}

CATEGORY_PRICES = {
    "digital_only": 0,
    "residential": 25000,
    "residential_plus": 45000,
    "professional": 60000,
    "institutional": 80000,
    "custom": 0,
}
CATEGORY_LABELS = {
    "digital_only": "Balise numérique (QR seul)",
    "residential": "Balise résidentielle (plaque standard)",
    "residential_plus": "Balise résidentielle+ (plaque premium)",
    "professional": "Balise professionnelle (commerce, PME)",
    "institutional": "Balise institutionnelle (administration, ONG)",
    "custom": "Balise sur mesure",
}

LOT_EVENT_FOR_STATUS = {
    "sent": "sent",
    "in_production": "in_production",
    "shipped": "shipped",
    "received": "received",
    "distributed": "distributed",
}


def lot_set_status(actor: dict[str, Any], row_id: str, data: dict[str, Any]) -> dict[str, Any]:
    status = required_text(data, "status", "Le statut")
    note = optional_text(data, "note")
    if status not in LOT_STATUSES:
        raise ActionError("Statut de lot invalide.")
    with connection.cursor() as cursor:
        cursor.execute("SELECT status FROM public.lots WHERE id = %s FOR UPDATE", [row_id])
        row = cursor.fetchone()
        if not row:
            raise ActionError("Lot introuvable.", status="not_found", http_status=404)
        cursor.execute("UPDATE public.lots SET status = %s WHERE id = %s", [status, row_id])
        event_type = LOT_EVENT_FOR_STATUS.get(status)
        if event_type:
            cursor.execute(
                "INSERT INTO public.lot_events (lot_id, event_type, actor_id, notes) VALUES (%s, %s, %s, %s)",
                [row_id, event_type, actor["user_id"], note],
            )
        audit(
            cursor,
            actor_id=actor["user_id"],
            action="lot.status.update",
            entity="lots",
            entity_id=row_id,
            before={"status": row[0]},
            after={"status": status, "note": note},
        )
    return {"ok": True, "status": status, "lot_id": row_id}


def lot_add_event(actor: dict[str, Any], row_id: str, data: dict[str, Any]) -> dict[str, Any]:
    note = required_text(data, "note", "La note")
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM public.lots WHERE id = %s", [row_id])
        if cursor.fetchone() is None:
            raise ActionError("Lot introuvable.", status="not_found", http_status=404)
        cursor.execute(
            """
            INSERT INTO public.lot_events (lot_id, event_type, actor_id, notes)
            VALUES (%s, 'note', %s, %s)
            RETURNING id
            """,
            [row_id, actor["user_id"], note],
        )
        event_id = cursor.fetchone()[0]
    return {"ok": True, "status": "created", "event_id": str(event_id)}


def supplier_upsert(actor: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
    supplier_id = optional_text(data, "supplier_id")
    name = required_text(data, "name", "Le nom fournisseur")
    payload = {
        "contact_name": optional_text(data, "contact_name"),
        "email": optional_text(data, "email"),
        "phone": optional_text(data, "phone"),
        "address": optional_text(data, "address"),
        "rccm": optional_text(data, "rccm"),
        "nif": optional_text(data, "nif"),
        "notes": optional_text(data, "notes"),
        "active": bool_value(data.get("active"), True),
    }
    with connection.cursor() as cursor:
        if supplier_id:
            cursor.execute("SELECT name, active FROM public.suppliers WHERE id = %s FOR UPDATE", [supplier_id])
            before = cursor.fetchone()
            if not before:
                raise ActionError("Fournisseur introuvable.", status="not_found", http_status=404)
            cursor.execute(
                """
                UPDATE public.suppliers
                SET name = %s, contact_name = %s, email = %s, phone = %s,
                    address = %s, rccm = %s, nif = %s, notes = %s,
                    active = %s, updated_at = NOW()
                WHERE id = %s
                """,
                [name, payload["contact_name"], payload["email"], payload["phone"], payload["address"], payload["rccm"], payload["nif"], payload["notes"], payload["active"], supplier_id],
            )
            result_id = supplier_id
            audit(cursor, actor_id=actor["user_id"], action="supplier.update", entity="suppliers", entity_id=supplier_id, before={"name": before[0], "active": before[1]}, after={"name": name, **payload})
        else:
            cursor.execute(
                """
                INSERT INTO public.suppliers
                    (name, contact_name, email, phone, address, rccm, nif, notes, active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                [name, payload["contact_name"], payload["email"], payload["phone"], payload["address"], payload["rccm"], payload["nif"], payload["notes"], payload["active"]],
            )
            result_id = str(cursor.fetchone()[0])
            audit(cursor, actor_id=actor["user_id"], action="supplier.create", entity="suppliers", entity_id=result_id, after={"name": name, **payload})
    return {"ok": True, "status": "saved", "supplier_id": str(result_id)}


def generate_po(actor: dict[str, Any], lot_id: str) -> dict[str, Any]:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT id, code, quantity, supplier, category, expected_delivery FROM public.lots WHERE id = %s FOR UPDATE",
            [lot_id],
        )
        lot = cursor.fetchone()
        if not lot:
            raise ActionError("Lot introuvable.", status="not_found", http_status=404)
        cursor.execute("SELECT id, po_number FROM public.purchase_orders WHERE lot_id = %s LIMIT 1", [lot_id])
        existing = cursor.fetchone()
        if existing:
            return {"ok": True, "status": "exists", "po_id": str(existing[0]), "po_number": existing[1]}

        supplier_id = None
        supplier_snapshot: dict[str, Any] = {"name": lot[3] or "Fournisseur inconnu"}
        if lot[3]:
            cursor.execute(
                """
                SELECT id, name, contact_name, email, phone, address, rccm, nif
                FROM public.suppliers WHERE name = %s LIMIT 1
                """,
                [lot[3]],
            )
            supplier = cursor.fetchone()
            if supplier:
                supplier_id = supplier[0]
                supplier_snapshot = {
                    "id": str(supplier[0]), "name": supplier[1], "contact_name": supplier[2],
                    "email": supplier[3], "phone": supplier[4], "address": supplier[5],
                    "rccm": supplier[6], "nif": supplier[7],
                }

        po_number = next_db_number(cursor, "next_po_number")
        category = lot[4] or "residential"
        unit_price = int(CATEGORY_PRICES.get(category, 0))
        quantity = int(lot[2] or 0)
        amount_ht = unit_price * quantity
        tva_rate = Decimal("18.00")
        tva_amount = int(round(Decimal(amount_ht) * tva_rate / Decimal(100)))
        amount_ttc = amount_ht + tva_amount

        cursor.execute(
            """
            INSERT INTO public.purchase_orders
                (po_number, lot_id, supplier_id, supplier_snapshot, expected_delivery,
                 payment_terms, amount_ht, tva_rate, tva_amount, amount_ttc,
                 currency, status, created_by)
            VALUES
                (%s, %s, %s, %s::jsonb, %s, 'Paiement à 30 jours date de facture',
                 %s, %s, %s, %s, 'GNF', 'draft', %s)
            RETURNING id
            """,
            [po_number, lot_id, supplier_id, json.dumps(supplier_snapshot), lot[5], amount_ht, tva_rate, tva_amount, amount_ttc, actor["user_id"]],
        )
        po_id = cursor.fetchone()[0]
        cursor.execute(
            """
            INSERT INTO public.purchase_order_lines
                (po_id, designation, category, quantity, unit_price_ht, line_total_ht, position)
            VALUES (%s, %s, %s, %s, %s, %s, 1)
            """,
            [po_id, f"{CATEGORY_LABELS.get(category, 'Balise')} — Lot {lot[1]}", category, quantity, unit_price, amount_ht],
        )
        audit(cursor, actor_id=actor["user_id"], action="purchase_order.create", entity="purchase_orders", entity_id=str(po_id), after={"po_number": po_number, "lot_id": lot_id, "amount_ttc": amount_ttc})
    return {"ok": True, "status": "created", "po_id": str(po_id), "po_number": po_number}


def update_po(actor: dict[str, Any], lot_id: str, data: dict[str, Any]) -> dict[str, Any]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, status, payment_terms, notes, expected_delivery
            FROM public.purchase_orders
            WHERE lot_id = %s
            ORDER BY created_at DESC
            LIMIT 1
            FOR UPDATE
            """,
            [lot_id],
        )
        row = cursor.fetchone()
        if not row:
            raise ActionError("Bon de commande introuvable.")
        po_id, current_status, current_terms, current_notes, current_delivery = row
        status = optional_text(data, "status") or current_status
        if status not in PO_STATUSES:
            raise ActionError("Statut BC invalide.")
        payment_terms = optional_text(data, "payment_terms") if "payment_terms" in data else current_terms
        notes = optional_text(data, "notes") if "notes" in data else current_notes
        expected_delivery = optional_text(data, "expected_delivery") if "expected_delivery" in data else current_delivery
        cursor.execute(
            "UPDATE public.purchase_orders SET status = %s, payment_terms = %s, notes = %s, expected_delivery = %s WHERE id = %s",
            [status, payment_terms, notes, expected_delivery, po_id],
        )
        audit(cursor, actor_id=actor["user_id"], action="purchase_order.update", entity="purchase_orders", entity_id=str(po_id), before={"status": current_status, "payment_terms": current_terms, "notes": current_notes}, after={"status": status, "payment_terms": payment_terms, "notes": notes, "expected_delivery": str(expected_delivery) if expected_delivery else None})
    return {"ok": True, "status": "updated", "po_id": str(po_id)}


@transaction.atomic
def generate_dn(
    actor: dict[str, Any],
    lot_id: str,
    data: dict[str, Any],
) -> dict[str, Any]:
    quantity_received = int_value(
        data.get("quantity_received")
    )
    quantity_shipped = (
        int_value(
            data.get("quantity_shipped"),
            0,
        )
        if data.get("quantity_shipped") not in {None, ""}
        else None
    )
    qc_passed = bool_value(
        data.get("qc_passed"),
        False,
    )

    if quantity_received <= 0:
        raise ActionError(
            "La quantité reçue doit être strictement positive."
        )

    if (
        quantity_shipped is not None
        and quantity_shipped < 0
    ):
        raise ActionError(
            "La quantité expédiée doit être positive."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            '''
            SELECT
                id,
                code,
                quantity,
                supplier,
                status
            FROM public.lots
            WHERE id = %s
            FOR UPDATE
            ''',
            [lot_id],
        )
        lot = cursor.fetchone()

        if not lot:
            raise ActionError(
                "Lot introuvable.",
                status="not_found",
                http_status=404,
            )

        lot_quantity = int(lot[2] or 0)

        if quantity_received > lot_quantity:
            raise ActionError(
                "La quantité reçue dépasse la quantité commandée."
            )

        cursor.execute(
            '''
            SELECT
                id,
                supplier_snapshot,
                status
            FROM public.purchase_orders
            WHERE lot_id = %s
              AND status <> 'cancelled'
            ORDER BY created_at DESC
            LIMIT 1
            FOR UPDATE
            ''',
            [lot_id],
        )
        po = cursor.fetchone()

        if not po:
            raise ActionError(
                (
                    "Un bon de commande fournisseur actif "
                    "est obligatoire avant toute réception."
                ),
                status="missing_purchase_order",
                http_status=409,
            )

        cursor.execute(
            '''
            SELECT COALESCE(
                SUM(quantity_received),
                0
            )::integer
            FROM public.delivery_notes
            WHERE lot_id = %s
              AND qc_passed IS TRUE
            ''',
            [lot_id],
        )
        accepted_before = int(
            cursor.fetchone()[0] or 0
        )

        accepted_after = accepted_before
        selected_ids: list[str] = []

        if qc_passed:
            accepted_after = (
                accepted_before + quantity_received
            )

            if accepted_after > lot_quantity:
                raise ActionError(
                    (
                        "Le cumul des réceptions conformes "
                        "dépasse la quantité commandée."
                    ),
                    status="receipt_overage",
                    http_status=409,
                )

            cursor.execute(
                '''
                SELECT id::text
                FROM public.beacons
                WHERE lot_id = %s
                  AND numbering_version = 'v1'
                  AND category <> 'digital_only'
                  AND status = 'generated'
                ORDER BY
                    national_id ASC NULLS LAST,
                    created_at ASC,
                    id ASC
                FOR UPDATE
                LIMIT %s
                ''',
                [lot_id, quantity_received],
            )

            selected_ids = [
                str(row[0])
                for row in cursor.fetchall()
            ]

            if len(selected_ids) != quantity_received:
                raise ActionError(
                    (
                        "Stock V1 généré insuffisant pour "
                        "libérer cette réception. "
                        f"Demandé : {quantity_received}, "
                        f"disponible : {len(selected_ids)}."
                    ),
                    status="stock_mismatch",
                    http_status=409,
                )

        dn_number = next_db_number(
            cursor,
            "next_dn_number",
        )

        supplier_snapshot = (
            po[1]
            if po[1] is not None
            else {
                "name":
                    lot[3]
                    or "Fournisseur inconnu"
            }
        )

        snapshot_json = (
            supplier_snapshot
            if isinstance(supplier_snapshot, str)
            else json.dumps(supplier_snapshot)
        )

        cursor.execute(
            '''
            INSERT INTO public.delivery_notes (
                dn_number,
                lot_id,
                po_id,
                supplier_snapshot,
                shipped_at,
                carrier,
                tracking_number,
                quantity_ordered,
                quantity_shipped,
                quantity_received,
                qc_passed,
                defects,
                receiver_name,
                notes,
                created_by
            )
            VALUES (
                %s, %s, %s, %s::jsonb, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s
            )
            RETURNING id
            ''',
            [
                dn_number,
                lot_id,
                po[0],
                snapshot_json,
                optional_text(data, "shipped_at"),
                optional_text(data, "carrier"),
                optional_text(data, "tracking_number"),
                lot_quantity,
                quantity_shipped,
                quantity_received,
                qc_passed,
                optional_text(data, "defects"),
                optional_text(data, "receiver_name"),
                optional_text(data, "notes"),
                actor["user_id"],
            ],
        )
        dn_id = cursor.fetchone()[0]

        available_count = 0
        resulting_lot_status = str(lot[4])

        if qc_passed:
            cursor.execute(
                '''
                UPDATE public.beacons
                SET status = 'available'
                WHERE id = ANY(%s::uuid[])
                  AND status = 'generated'
                ''',
                [selected_ids],
            )

            available_count = len(selected_ids)

            if accepted_after == lot_quantity:
                cursor.execute(
                    '''
                    UPDATE public.lots
                    SET
                        status = 'received',
                        qc_passed = TRUE,
                        received_at = COALESCE(
                            received_at,
                            NOW()
                        )
                    WHERE id = %s
                    ''',
                    [lot_id],
                )
                resulting_lot_status = "received"

        audit(
            cursor,
            actor_id=actor["user_id"],
            action="delivery_note.create",
            entity="delivery_notes",
            entity_id=str(dn_id),
            after={
                "dn_number": dn_number,
                "lot_id": lot_id,
                "quantity_received": quantity_received,
                "qc_passed": qc_passed,
                "accepted_before": accepted_before,
                "accepted_after": accepted_after,
                "beacons_available": available_count,
                "lot_status": resulting_lot_status,
            },
        )

    return {
        "ok": True,
        "status": "created",
        "dn_id": str(dn_id),
        "dn_number": dn_number,
        "qc_passed": qc_passed,
        "quantity_received": quantity_received,
        "quantity_available": available_count,
        "accepted_total": accepted_after,
        "quantity_remaining": max(
            0,
            lot_quantity - accepted_after,
        ),
        "lot_status": resulting_lot_status,
    }


def create_invoice(actor: dict[str, Any], lot_id: str, data: dict[str, Any]) -> dict[str, Any]:
    invoice_number = required_text(data, "invoice_number", "Le numéro de facture")
    issued_at = required_text(data, "issued_at", "La date de facture")
    amount_ht = int_value(data.get("amount_ht"))
    if amount_ht < 0:
        raise ActionError("Le montant HT doit être positif.")
    tva_rate = decimal_value(data.get("tva_rate"), Decimal("18.00"))
    if tva_rate < 0:
        raise ActionError("Le taux de TVA doit être positif.")
    tva_amount = int(round(Decimal(amount_ht) * tva_rate / Decimal(100)))
    amount_ttc = amount_ht + tva_amount

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT l.id, l.supplier, po.id, po.supplier_id, po.supplier_snapshot, dn.id
            FROM public.lots l
            LEFT JOIN public.purchase_orders po ON po.lot_id = l.id
            LEFT JOIN public.delivery_notes dn ON dn.lot_id = l.id
            WHERE l.id = %s
            ORDER BY po.created_at DESC NULLS LAST, dn.created_at DESC NULLS LAST
            LIMIT 1
            """,
            [lot_id],
        )
        row = cursor.fetchone()
        if not row:
            raise ActionError("Lot introuvable.", status="not_found", http_status=404)
        internal_ref = next_db_number(cursor, "next_pi_number")
        supplier_snapshot = row[4] if row[4] is not None else {"name": row[1] or "Fournisseur inconnu"}
        snapshot_json = supplier_snapshot if isinstance(supplier_snapshot, str) else json.dumps(supplier_snapshot)
        cursor.execute(
            """
            INSERT INTO public.purchase_invoices
                (internal_ref, invoice_number, lot_id, po_id, dn_id, supplier_id,
                 supplier_snapshot, issued_at, due_date, amount_ht, tva_rate,
                 tva_amount, amount_ttc, amount_paid, currency, payment_status,
                 notes, created_by)
            VALUES
                (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s,
                 0, 'GNF', 'unpaid', %s, %s)
            RETURNING id
            """,
            [internal_ref, invoice_number, lot_id, row[2], row[5], row[3], snapshot_json, issued_at, optional_text(data, "due_date"), amount_ht, tva_rate, tva_amount, amount_ttc, optional_text(data, "notes"), actor["user_id"]],
        )
        invoice_id = cursor.fetchone()[0]
        audit(cursor, actor_id=actor["user_id"], action="purchase_invoice.create", entity="purchase_invoices", entity_id=str(invoice_id), after={"internal_ref": internal_ref, "invoice_number": invoice_number, "amount_ttc": amount_ttc})
    return {"ok": True, "status": "created", "invoice_id": str(invoice_id), "internal_ref": internal_ref}


def record_payment(actor: dict[str, Any], lot_id: str, data: dict[str, Any]) -> dict[str, Any]:
    amount = int_value(data.get("amount"))
    if amount <= 0:
        raise ActionError("Le montant doit être strictement positif.")
    method = required_text(data, "method", "Le mode de paiement")
    if method not in PAYMENT_METHODS:
        raise ActionError("Mode de paiement invalide.")

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, amount_ttc, amount_paid, payment_status
            FROM public.purchase_invoices
            WHERE lot_id = %s
            ORDER BY created_at DESC
            LIMIT 1
            FOR UPDATE
            """,
            [lot_id],
        )
        invoice = cursor.fetchone()
        if not invoice:
            raise ActionError("Facture fournisseur introuvable.")
        invoice_id, amount_ttc, amount_paid, payment_status = invoice
        if payment_status == "cancelled":
            raise ActionError("Une facture annulée ne peut pas être réglée.")
        remaining = int(amount_ttc) - int(amount_paid)
        if amount > remaining:
            raise ActionError("Le règlement dépasse le solde restant.")
        paid_at = optional_text(data, "paid_at")
        cursor.execute(
            """
            INSERT INTO public.purchase_invoice_payments
                (invoice_id, paid_at, amount, method, reference, notes, created_by)
            VALUES (%s, COALESCE(%s::timestamptz, NOW()), %s, %s, %s, %s, %s)
            RETURNING id
            """,
            [invoice_id, paid_at, amount, method, optional_text(data, "reference"), optional_text(data, "notes"), actor["user_id"]],
        )
        payment_id = cursor.fetchone()[0]
        new_paid = int(amount_paid) + amount
        new_status = "paid" if new_paid >= int(amount_ttc) else "partial"
        cursor.execute(
            "UPDATE public.purchase_invoices SET amount_paid = %s, payment_status = %s, updated_at = NOW() WHERE id = %s",
            [new_paid, new_status, invoice_id],
        )
        audit(cursor, actor_id=actor["user_id"], action="purchase_invoice.payment.record", entity="purchase_invoices", entity_id=str(invoice_id), before={"amount_paid": int(amount_paid), "payment_status": payment_status}, after={"amount_paid": new_paid, "payment_status": new_status, "payment_id": str(payment_id)})
    return {"ok": True, "status": new_status, "invoice_id": str(invoice_id), "payment_id": str(payment_id)}


def dispute(actor: dict[str, Any], lot_id: str, data: dict[str, Any], *, resolve: bool) -> dict[str, Any]:
    note = None if resolve else required_text(data, "note", "Le motif")
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, payment_status, dispute_notes, amount_paid, amount_ttc
            FROM public.purchase_invoices
            WHERE lot_id = %s
            ORDER BY created_at DESC
            LIMIT 1
            FOR UPDATE
            """,
            [lot_id],
        )
        invoice = cursor.fetchone()
        if not invoice:
            raise ActionError("Facture fournisseur introuvable.")
        invoice_id, current_status, current_note, amount_paid, amount_ttc = invoice
        if resolve:
            target = "paid" if int(amount_paid) >= int(amount_ttc) else ("partial" if int(amount_paid) > 0 else "unpaid")
            dispute_note = None
            action_name = "purchase_invoice.dispute.resolve"
        else:
            if current_status == "cancelled":
                raise ActionError("Une facture annulée ne peut pas être mise en litige.")
            target = "disputed"
            dispute_note = note
            action_name = "purchase_invoice.dispute.open"
        cursor.execute(
            "UPDATE public.purchase_invoices SET payment_status = %s, dispute_notes = %s, updated_at = NOW() WHERE id = %s",
            [target, dispute_note, invoice_id],
        )
        audit(cursor, actor_id=actor["user_id"], action=action_name, entity="purchase_invoices", entity_id=str(invoice_id), before={"payment_status": current_status, "dispute_notes": current_note}, after={"payment_status": target, "dispute_notes": dispute_note})
    return {"ok": True, "status": target, "invoice_id": str(invoice_id)}
