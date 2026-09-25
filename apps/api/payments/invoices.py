from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from io import BytesIO

from django.conf import settings
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


@dataclass(frozen=True)
class InvoiceItem:
    label: str
    qty: int
    unit_price_gnf: int


@dataclass(frozen=True)
class InvoicePdfData:
    number: str
    issued_at: str
    order_ref: str
    client_name: str
    client_phone: str | None
    client_email: str | None
    items: tuple[InvoiceItem, ...]
    total_gnf: int


def _gnf(value: int) -> str:
    return f"{int(value):,}".replace(",", " ") + " GNF"


def _safe_ascii(value: str) -> str:
    return (
        str(value or "")
        .replace("’", "'")
        .replace("–", "-")
        .replace("—", "-")
    )



def invoice_legal_identity_status() -> dict[str, bool]:
    legal_name = str(
        getattr(settings, "INVOICE_LEGAL_NAME", "")
    ).strip()

    legal_address = str(
        getattr(settings, "INVOICE_LEGAL_ADDRESS", "")
    ).strip()

    legal_id = str(
        getattr(settings, "INVOICE_LEGAL_ID", "")
    ).strip()

    invalid_id = (
        not legal_id
        or "XXXX" in legal_id.upper()
        or "PLACEHOLDER" in legal_id.upper()
    )

    return {
        "name": bool(legal_name),
        "address": bool(legal_address),
        "id": bool(legal_id) and not invalid_id,
    }


def require_invoice_legal_identity() -> tuple[str, str, str]:
    status = invoice_legal_identity_status()

    if not all(status.values()):
        missing = [
            key
            for key, ready in status.items()
            if not ready
        ]

        raise RuntimeError(
            "Identité légale de facturation non configurée : "
            + ", ".join(missing)
        )

    return (
        str(settings.INVOICE_LEGAL_NAME).strip(),
        str(settings.INVOICE_LEGAL_ADDRESS).strip(),
        str(settings.INVOICE_LEGAL_ID).strip(),
    )

def render_invoice_pdf(data: InvoicePdfData) -> bytes:
    legal_name, legal_address, legal_id = (
        require_invoice_legal_identity()
    )

    buffer = BytesIO()
    pdf = canvas.Canvas(
        buffer,
        pagesize=A4,
        pageCompression=1,
    )

    width, height = A4
    margin = 48
    y = height - margin

    pdf.setFont("Helvetica-Bold", 22)
    pdf.drawString(
        margin,
        y,
        "ADRESSE GN",
    )

    pdf.setFont("Helvetica", 9)
    pdf.drawString(
        margin,
        y - 16,
        "Un lieu - Un numero - Un itineraire",
    )

    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawRightString(
        width - margin,
        y,
        "FACTURE",
    )

    pdf.setFont("Helvetica", 10)
    pdf.drawRightString(
        width - margin,
        y - 16,
        _safe_ascii(data.number),
    )

    y -= 48
    pdf.line(
        margin,
        y,
        width - margin,
        y,
    )

    y -= 24
    pdf.setFont("Helvetica", 9)

    for line in (
        legal_name,
        legal_address,
        f"NIF : {legal_id}",
    ):
        pdf.drawString(
            margin,
            y,
            _safe_ascii(line),
        )
        y -= 13

    client_y = height - margin - 72
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(
        width / 2 + 20,
        client_y,
        "Client",
    )

    pdf.setFont("Helvetica", 9)

    for idx, line in enumerate(
        filter(
            None,
            (
                data.client_name,
                data.client_phone,
                data.client_email,
            ),
        ),
        start=1,
    ):
        pdf.drawString(
            width / 2 + 20,
            client_y - idx * 13,
            _safe_ascii(str(line)),
        )

    y -= 28
    pdf.setFont("Helvetica", 10)
    pdf.drawString(
        margin,
        y,
        f"Commande : {_safe_ascii(data.order_ref)}",
    )

    pdf.drawRightString(
        width - margin,
        y,
        f"Date : {_safe_ascii(data.issued_at[:10])}",
    )

    y -= 32
    pdf.setFont("Helvetica-Bold", 9)

    pdf.drawString(
        margin,
        y,
        "Designation",
    )
    pdf.drawRightString(
        width - 220,
        y,
        "Qte",
    )
    pdf.drawRightString(
        width - 110,
        y,
        "Prix unitaire",
    )
    pdf.drawRightString(
        width - margin,
        y,
        "Total",
    )

    y -= 16
    pdf.line(
        margin,
        y,
        width - margin,
        y,
    )

    y -= 18
    pdf.setFont("Helvetica", 9)

    for item in data.items:
        label = _safe_ascii(item.label)
        max_width = width - margin * 2 - 245

        while (
            label
            and stringWidth(
                label,
                "Helvetica",
                9,
            )
            > max_width
        ):
            label = label[:-1]

        pdf.drawString(
            margin,
            y,
            label,
        )
        pdf.drawRightString(
            width - 220,
            y,
            str(item.qty),
        )
        pdf.drawRightString(
            width - 110,
            y,
            _gnf(
                item.unit_price_gnf
            ),
        )
        pdf.drawRightString(
            width - margin,
            y,
            _gnf(
                item.unit_price_gnf
                * item.qty
            ),
        )

        y -= 18

        if y < 140:
            pdf.showPage()
            y = height - margin
            pdf.setFont(
                "Helvetica",
                9,
            )

    y -= 8
    pdf.line(
        width / 2,
        y,
        width - margin,
        y,
    )

    y -= 20
    pdf.setFont(
        "Helvetica",
        9,
    )
    pdf.drawString(
        width / 2,
        y,
        "Sous-total",
    )
    pdf.drawRightString(
        width - margin,
        y,
        _gnf(
            data.total_gnf
        ),
    )

    y -= 16
    pdf.drawString(
        width / 2,
        y,
        "TVA (0%)",
    )
    pdf.drawRightString(
        width - margin,
        y,
        _gnf(0),
    )

    y -= 22
    pdf.setFont(
        "Helvetica-Bold",
        11,
    )
    pdf.drawString(
        width / 2,
        y,
        "TOTAL A PAYER",
    )
    pdf.drawRightString(
        width - margin,
        y,
        _gnf(
            data.total_gnf
        ),
    )

    y -= 44
    pdf.setFont(
        "Helvetica",
        9,
    )
    pdf.drawString(
        margin,
        y,
        "Facture acquittee. Merci de votre confiance.",
    )

    pdf.setFont(
        "Helvetica",
        7.5,
    )

    footer = (
        f"{legal_name} - {legal_address} - NIF {legal_id}",
        "Montants exprimes en francs guineens (GNF).",
        "Document genere automatiquement.",
    )

    footer_y = 54

    for line in footer:
        pdf.drawString(
            margin,
            footer_y,
            _safe_ascii(line),
        )
        footer_y -= 11

    pdf.save()
    return buffer.getvalue()


def invoice_storage_path(
    customer_id: str,
    invoice_number: str,
) -> str:
    clean_customer = str(
        customer_id
    ).strip()

    clean_number = (
        str(invoice_number)
        .strip()
        .replace("/", "-")
    )

    if not clean_customer:
        raise ValueError(
            "customer_id requis"
        )

    if not clean_number:
        raise ValueError(
            "invoice_number requis"
        )

    return (
        f"{clean_customer}/"
        f"{clean_number}.pdf"
    )


def _storage_request(
    *,
    method: str,
    path: str,
    data: bytes | None = None,
    content_type: str = "application/json",
    extra_headers: dict[str, str] | None = None,
) -> bytes:
    base_url = str(
        settings.SUPABASE_URL
    ).rstrip("/")

    server_key = str(
        settings.SUPABASE_SERVER_KEY
    ).strip()

    if not server_key:
        raise RuntimeError(
            "SUPABASE_SERVER_KEY non configure."
        )

    headers = {
        "Authorization":
            f"Bearer {server_key}",
        "apikey": server_key,
        "Content-Type":
            content_type,
    }

    if extra_headers:
        headers.update(
            {
                str(key): str(value)
                for key, value
                in extra_headers.items()
            }
        )

    request = urllib.request.Request(
        f"{base_url}{path}",
        data=data,
        method=method,
        headers=headers,
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=30,
        ) as response:
            return response.read()

    except urllib.error.HTTPError as exc:
        body = exc.read().decode(
            "utf-8",
            errors="replace",
        )

        raise RuntimeError(
            "Supabase Storage HTTP "
            f"{exc.code}: {body[:500]}"
        ) from exc


def upload_invoice_pdf(
    *,
    storage_path: str,
    pdf_bytes: bytes,
) -> None:
    encoded_path = urllib.parse.quote(
        storage_path,
        safe="/",
    )

    _storage_request(
        method="POST",
        path=(
            "/storage/v1/object/"
            f"invoices/{encoded_path}"
        ),
        data=pdf_bytes,
        content_type="application/pdf",
        extra_headers={
            "x-upsert": "true",
        },
    )


def create_invoice_signed_url(
    *,
    storage_path: str,
    expires_in: int = 31_536_000,
) -> str:
    encoded_path = urllib.parse.quote(
        storage_path,
        safe="/",
    )

    payload = json.dumps(
        {
            "expiresIn":
                int(expires_in),
        }
    ).encode("utf-8")

    raw = _storage_request(
        method="POST",
        path=(
            "/storage/v1/object/sign/"
            f"invoices/{encoded_path}"
        ),
        data=payload,
    )

    parsed = json.loads(
        raw.decode("utf-8")
    )

    signed = (
        parsed.get("signedURL")
        or parsed.get("signedUrl")
    )

    if not signed:
        raise RuntimeError(
            "URL signee absente de la reponse Storage."
        )

    base_url = str(
        settings.SUPABASE_URL
    ).rstrip("/")

    if str(signed).startswith(
        "http"
    ):
        return str(signed)

    return (
        f"{base_url}/storage/v1"
        f"{signed}"
    )


# ============================================================
# PHASE 15G2B9E — invoice chain core
# ============================================================

class InvoiceChainError(RuntimeError):
    pass


def _next_invoice_number() -> str:
    from django.db import connection

    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT public.next_invoice_ref()"
        )
        row = cursor.fetchone()

    if row is None or not row[0]:
        raise InvoiceChainError(
            "Impossible de générer le numéro de facture."
        )

    return str(row[0])


def _normalize_invoice_order_items(
    value,
) -> list[dict]:
    candidate = value

    if isinstance(candidate, str):
        try:
            candidate = json.loads(
                candidate
            )
        except (TypeError, ValueError):
            return []

    if isinstance(candidate, tuple):
        candidate = list(candidate)

    if not isinstance(candidate, list):
        return []

    return [
        item
        for item in candidate
        if isinstance(item, dict)
    ]


def prepare_paid_invoice_record(
    *,
    order_id: str,
) -> dict:
    # Garde impérative AVANT tout accès au générateur de numéro.
    require_invoice_legal_identity()

    from django.db import connection, transaction

    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    o.id,
                    o.order_ref,
                    o.customer_id,
                    o.status,
                    o.amount_gnf
                FROM public.orders o
                WHERE o.id = %s
                FOR UPDATE
                """,
                [order_id],
            )

            order = cursor.fetchone()

            if order is None:
                raise InvoiceChainError(
                    "Commande introuvable."
                )

            (
                locked_order_id,
                order_ref,
                customer_id,
                order_status,
                amount_gnf,
            ) = order

            if customer_id is None:
                raise InvoiceChainError(
                    "Commande sans customer_id : facture interdite."
                )

            if str(order_status) != "paid":
                raise InvoiceChainError(
                    "La facture ne peut être émise que pour une commande payée."
                )

            amount = int(
                amount_gnf
                or 0
            )

            if amount <= 0:
                raise InvoiceChainError(
                    "Montant de commande invalide pour facturation."
                )

            cursor.execute(
                """
                SELECT
                    id,
                    order_id,
                    number,
                    amount_gnf,
                    status,
                    paid_at,
                    issued_at,
                    pdf_url
                FROM public.invoices
                WHERE order_id = %s
                FOR UPDATE
                """,
                [locked_order_id],
            )

            existing = cursor.fetchone()

            if existing is not None:
                (
                    invoice_id,
                    invoice_order_id,
                    number,
                    invoice_amount,
                    status,
                    paid_at,
                    issued_at,
                    pdf_url,
                ) = existing

                if str(status) == "void":
                    raise InvoiceChainError(
                        "La facture existante est annulée."
                    )

                if int(
                    invoice_amount
                    or 0
                ) != amount:
                    raise InvoiceChainError(
                        "Montant de facture incohérent avec la commande."
                    )

                if str(status) != "paid":
                    cursor.execute(
                        """
                        UPDATE public.invoices
                        SET
                            status = 'paid',
                            paid_at = COALESCE(
                                paid_at,
                                NOW()
                            )
                        WHERE id = %s
                        RETURNING
                            id,
                            order_id,
                            number,
                            amount_gnf,
                            status,
                            paid_at,
                            issued_at,
                            pdf_url
                        """,
                        [invoice_id],
                    )
                    existing = cursor.fetchone()

                    (
                        invoice_id,
                        invoice_order_id,
                        number,
                        invoice_amount,
                        status,
                        paid_at,
                        issued_at,
                        pdf_url,
                    ) = existing

                return {
                    "id": str(invoice_id),
                    "order_id": str(invoice_order_id),
                    "order_ref": str(order_ref),
                    "customer_id": str(customer_id),
                    "number": str(number),
                    "amount_gnf": int(invoice_amount),
                    "status": str(status),
                    "paid_at": paid_at,
                    "issued_at": issued_at,
                    "pdf_url": pdf_url,
                    "created": False,
                }

            number = _next_invoice_number()

            cursor.execute(
                """
                INSERT INTO public.invoices (
                    order_id,
                    number,
                    amount_gnf,
                    status,
                    paid_at,
                    issued_at,
                    pdf_url
                )
                VALUES (
                    %s,
                    %s,
                    %s,
                    'paid',
                    NOW(),
                    NOW(),
                    NULL
                )
                RETURNING
                    id,
                    order_id,
                    number,
                    amount_gnf,
                    status,
                    paid_at,
                    issued_at,
                    pdf_url
                """,
                [
                    locked_order_id,
                    number,
                    amount,
                ],
            )

            created = cursor.fetchone()

    (
        invoice_id,
        invoice_order_id,
        number,
        invoice_amount,
        status,
        paid_at,
        issued_at,
        pdf_url,
    ) = created

    return {
        "id": str(invoice_id),
        "order_id": str(invoice_order_id),
        "order_ref": str(order_ref),
        "customer_id": str(customer_id),
        "number": str(number),
        "amount_gnf": int(invoice_amount),
        "status": str(status),
        "paid_at": paid_at,
        "issued_at": issued_at,
        "pdf_url": pdf_url,
        "created": True,
    }


def _load_invoice_pdf_context(
    *,
    invoice_id: str,
) -> dict:
    require_invoice_legal_identity()

    from django.db import connection

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                i.id,
                i.number,
                i.issued_at,
                i.amount_gnf,
                i.pdf_url,
                o.id,
                o.order_ref,
                o.customer_id,
                o.status,
                o.items,
                p.full_name,
                p.phone,
                au.email
            FROM public.invoices i
            JOIN public.orders o
              ON o.id = i.order_id
            LEFT JOIN public.profiles p
              ON p.id = o.customer_id
            LEFT JOIN auth.users au
              ON au.id = o.customer_id
            WHERE i.id = %s
            LIMIT 1
            """,
            [invoice_id],
        )

        row = cursor.fetchone()

    if row is None:
        raise InvoiceChainError(
            "Facture introuvable."
        )

    (
        loaded_invoice_id,
        number,
        issued_at,
        amount_gnf,
        pdf_url,
        order_id,
        order_ref,
        customer_id,
        order_status,
        order_items,
        full_name,
        phone,
        email,
    ) = row

    if customer_id is None:
        raise InvoiceChainError(
            "Facture liée à une commande sans client."
        )

    if str(order_status) != "paid":
        raise InvoiceChainError(
            "Commande non payée : génération PDF interdite."
        )

    normalized = _normalize_invoice_order_items(
        order_items
    )

    invoice_items = []

    for item in normalized:
        qty = int(
            item.get("qty")
            or 0
        )

        unit_price = int(
            item.get("unit_price_gnf")
            or 0
        )

        label = str(
            item.get("label")
            or item.get("code")
            or item.get("ref")
            or "Adresse GN"
        ).strip()

        if qty <= 0:
            raise InvoiceChainError(
                "Quantité de facture invalide."
            )

        if unit_price < 0:
            raise InvoiceChainError(
                "Prix unitaire de facture invalide."
            )

        invoice_items.append(
            InvoiceItem(
                label=label,
                qty=qty,
                unit_price_gnf=unit_price,
            )
        )

    if not invoice_items:
        raise InvoiceChainError(
            "Aucun item canonique disponible pour la facture."
        )

    pdf_data = InvoicePdfData(
        number=str(number),
        issued_at=(
            issued_at.isoformat()
            if hasattr(
                issued_at,
                "isoformat",
            )
            else str(issued_at)
        ),
        order_ref=str(order_ref),
        client_name=str(
            full_name
            or "Client Adresse GN"
        ),
        client_phone=(
            str(phone)
            if phone
            else None
        ),
        client_email=(
            str(email)
            if email
            else None
        ),
        items=tuple(
            invoice_items
        ),
        total_gnf=int(
            amount_gnf
            or 0
        ),
    )

    return {
        "invoice_id": str(loaded_invoice_id),
        "order_id": str(order_id),
        "customer_id": str(customer_id),
        "number": str(number),
        "pdf_url": pdf_url,
        "pdf_data": pdf_data,
    }


def publish_invoice_pdf(
    *,
    invoice_id: str,
    expires_in: int = 31_536_000,
) -> dict:
    context = _load_invoice_pdf_context(
        invoice_id=invoice_id
    )

    if context["pdf_url"]:
        return {
            "invoice_id": context["invoice_id"],
            "number": context["number"],
            "pdf_url": str(
                context["pdf_url"]
            ),
            "published": False,
            "already_published": True,
        }

    pdf_bytes = render_invoice_pdf(
        context["pdf_data"]
    )

    storage_path = invoice_storage_path(
        customer_id=context["customer_id"],
        invoice_number=context["number"],
    )

    # L'upload est idempotent depuis 15G2B9D (x-upsert=true).
    # Aucun changement DB n'est effectué si l'upload ou la signature échoue.
    upload_invoice_pdf(
        storage_path=storage_path,
        pdf_bytes=pdf_bytes,
    )

    signed_url = create_invoice_signed_url(
        storage_path=storage_path,
        expires_in=expires_in,
    )

    from django.db import connection, transaction

    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT pdf_url
                FROM public.invoices
                WHERE id = %s
                FOR UPDATE
                """,
                [invoice_id],
            )

            current = cursor.fetchone()

            if current is None:
                raise InvoiceChainError(
                    "Facture introuvable après publication."
                )

            if current[0]:
                final_url = str(
                    current[0]
                )
                published = False
                already_published = True
            else:
                cursor.execute(
                    """
                    UPDATE public.invoices
                    SET pdf_url = %s
                    WHERE id = %s
                    RETURNING pdf_url
                    """,
                    [
                        signed_url,
                        invoice_id,
                    ],
                )
                final_url = str(
                    cursor.fetchone()[0]
                )
                published = True
                already_published = False

    return {
        "invoice_id": str(invoice_id),
        "number": context["number"],
        "pdf_url": final_url,
        "storage_path": storage_path,
        "published": published,
        "already_published": already_published,
    }
