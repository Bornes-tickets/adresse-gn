from __future__ import annotations

from dataclasses import asdict
from io import BytesIO
import json
import re
from typing import Any, Sequence
from urllib.parse import quote, urlsplit

from django.db import connection, transaction
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from .action_common import audit
from .external_supabase import (
    SupabaseExternalError,
    delete_storage_object,
    public_site_url,
    signed_storage_url,
    upload_storage_object,
)
from .manufacturing_documents import (
    MANUFACTURING_BUCKET,
    NUMBER_FORMAT_VERSION,
    ManufacturingBeaconIdentity,
    ManufacturingContractError,
    ManufacturingTemplateSnapshot,
    freeze_template_snapshot,
    manufacturing_beacon_identity,
    manufacturing_pdf_storage_path,
    normalize_category,
    sha256_pdf,
)


MAX_MANUFACTURING_PDF_BYTES = 25 * 1024 * 1024
_HEX_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")


class ManufacturingRuntimeError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        status: str = "invalid",
        http_status: int = 400,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.http_status = http_status


def _normalize_artwork_spec(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        normalized = dict(value)
    elif isinstance(value, str):
        raw = value.strip()
        if not raw:
            raise ManufacturingRuntimeError(
                "artwork_spec du modèle actif doit être un objet JSON non vide.",
                status="template_incomplete",
                http_status=409,
            )

        try:
            decoded = json.loads(raw)
        except (TypeError, ValueError, json.JSONDecodeError) as exc:
            raise ManufacturingRuntimeError(
                "artwork_spec du modèle actif contient un JSON invalide.",
                status="template_incomplete",
                http_status=409,
            ) from exc

        if not isinstance(decoded, dict):
            raise ManufacturingRuntimeError(
                "artwork_spec du modèle actif doit être un objet JSON.",
                status="template_incomplete",
                http_status=409,
            )
        normalized = dict(decoded)
    else:
        raise ManufacturingRuntimeError(
            "artwork_spec du modèle actif doit être un objet JSON non vide.",
            status="template_incomplete",
            http_status=409,
        )

    if not normalized:
        raise ManufacturingRuntimeError(
            "artwork_spec du modèle actif doit être un objet JSON non vide.",
            status="template_incomplete",
            http_status=409,
        )

    return normalized


def _canonical_site_origin(value: Any) -> str:
    raw = str(value or "").strip().rstrip("/")
    parsed = urlsplit(raw)

    if (
        parsed.scheme not in {"https", "http"}
        or not parsed.netloc
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise ManufacturingRuntimeError(
            "Origine publique canonique invalide.",
            status="site_origin_invalid",
        )

    path = parsed.path.rstrip("/")
    origin = f"{parsed.scheme}://{parsed.netloc}{path}"

    if parsed.hostname in {"localhost", "127.0.0.1", "::1"}:
        raise ManufacturingRuntimeError(
            "Le PDF fournisseur exige une origine publique non locale.",
            status="site_origin_invalid",
        )

    return origin


def canonical_manufacturing_qr_payload(
    *,
    site_origin: Any,
    identity: ManufacturingBeaconIdentity,
) -> str:
    origin = _canonical_site_origin(site_origin)
    number = quote(identity.public_number_stored, safe="")
    token = quote(identity.qr_token, safe="")
    return f"{origin}/a/{number}?qr={token}"


def _supplier_pdf_style(
    snapshot: ManufacturingTemplateSnapshot,
) -> dict[str, str]:
    raw = snapshot.artwork_spec.get("supplier_pdf")

    if not isinstance(raw, dict):
        raise ManufacturingRuntimeError(
            "Le modèle actif ne définit pas artwork_spec.supplier_pdf.",
            status="template_incomplete",
            http_status=409,
        )

    style = {
        "background_hex": str(raw.get("background_hex") or "").strip(),
        "border_hex": str(raw.get("border_hex") or "").strip(),
        "text_hex": str(raw.get("text_hex") or "").strip(),
        "accent_hex": str(raw.get("accent_hex") or "").strip(),
        "qr_position": str(raw.get("qr_position") or "").strip().lower(),
        "number_position": str(raw.get("number_position") or "").strip().lower(),
        "label": str(raw.get("label") or "").strip(),
    }

    for key in (
        "background_hex",
        "border_hex",
        "text_hex",
        "accent_hex",
    ):
        if not _HEX_COLOR.fullmatch(style[key]):
            raise ManufacturingRuntimeError(
                f"Couleur supplier_pdf invalide : {key}.",
                status="template_incomplete",
                http_status=409,
            )

    if style["qr_position"] not in {"left", "right"}:
        raise ManufacturingRuntimeError(
            "supplier_pdf.qr_position doit valoir left ou right.",
            status="template_incomplete",
            http_status=409,
        )

    if style["number_position"] not in {"top", "bottom"}:
        raise ManufacturingRuntimeError(
            "supplier_pdf.number_position doit valoir top ou bottom.",
            status="template_incomplete",
            http_status=409,
        )

    if not style["label"]:
        raise ManufacturingRuntimeError(
            "supplier_pdf.label est obligatoire.",
            status="template_incomplete",
            http_status=409,
        )

    return style


def _fit_font_size(
    pdf: canvas.Canvas,
    *,
    text: str,
    font_name: str,
    max_width: float,
    preferred_size: float,
    minimum_size: float = 6.0,
) -> float:
    size = preferred_size
    while (
        size > minimum_size
        and pdf.stringWidth(text, font_name, size) > max_width
    ):
        size -= 0.5
    return max(minimum_size, size)


def _draw_qr(
    pdf: canvas.Canvas,
    *,
    payload: str,
    x: float,
    y: float,
    size: float,
) -> None:
    widget = QrCodeWidget(payload)
    x0, y0, x1, y1 = widget.getBounds()
    width = x1 - x0
    height = y1 - y0

    drawing = Drawing(
        size,
        size,
        transform=[
            size / width,
            0,
            0,
            size / height,
            0,
            0,
        ],
    )
    drawing.add(widget)
    renderPDF.draw(drawing, pdf, x, y)


def _draw_wrapped_text(
    pdf: canvas.Canvas,
    *,
    text: str,
    x: float,
    y: float,
    max_width: float,
    font_name: str = "Helvetica",
    font_size: float = 8.0,
    leading: float = 10.0,
    max_lines: int = 6,
) -> float:
    words = text.split()
    lines: list[str] = []
    current = ""

    for word in words:
        candidate = word if not current else f"{current} {word}"
        if pdf.stringWidth(candidate, font_name, font_size) <= max_width:
            current = candidate
            continue
        if current:
            lines.append(current)
        current = word
        if len(lines) >= max_lines:
            break

    if current and len(lines) < max_lines:
        lines.append(current)

    pdf.setFont(font_name, font_size)
    current_y = y
    for line in lines:
        pdf.drawString(x, current_y, line)
        current_y -= leading
    return current_y


def _draw_plate_card(
    pdf: canvas.Canvas,
    *,
    x: float,
    y: float,
    width: float,
    height: float,
    identity: ManufacturingBeaconIdentity,
    qr_payload: str,
    snapshot: ManufacturingTemplateSnapshot,
    style: dict[str, str],
) -> None:
    pdf.setStrokeColor(HexColor("#D1D5DB"))
    pdf.setFillColor(HexColor("#FFFFFF"))
    pdf.roundRect(x, y, width, height, 7, stroke=1, fill=1)

    pad = 8 * mm
    title_y = y + height - 9 * mm
    pdf.setFillColor(HexColor("#111827"))
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(
        x + pad,
        title_y,
        f"{snapshot.name} v{snapshot.version}",
    )

    physical_w = float(snapshot.width_mm)
    physical_h = float(snapshot.height_mm)
    available_w = width - 2 * pad
    available_h = height - 27 * mm
    scale = min(
        available_w / physical_w,
        available_h / physical_h,
    )
    plate_w = physical_w * scale
    plate_h = physical_h * scale
    plate_x = x + (width - plate_w) / 2
    plate_y = y + 10 * mm + (available_h - plate_h) / 2

    pdf.setFillColor(HexColor(style["background_hex"]))
    pdf.setStrokeColor(HexColor(style["border_hex"]))
    pdf.roundRect(
        plate_x,
        plate_y,
        plate_w,
        plate_h,
        4,
        stroke=1,
        fill=1,
    )

    qr_side = min(plate_h * 0.45, plate_w * 0.26)
    qr_x = (
        plate_x + 4 * mm
        if style["qr_position"] == "left"
        else plate_x + plate_w - qr_side - 4 * mm
    )
    qr_y = plate_y + (plate_h - qr_side) / 2
    _draw_qr(
        pdf,
        payload=qr_payload,
        x=qr_x,
        y=qr_y,
        size=qr_side,
    )

    number_left = (
        qr_x + qr_side + 4 * mm
        if style["qr_position"] == "left"
        else plate_x + 4 * mm
    )
    number_right = (
        plate_x + plate_w - 4 * mm
        if style["qr_position"] == "left"
        else qr_x - 4 * mm
    )
    number_width = max(20 * mm, number_right - number_left)

    pdf.setFillColor(HexColor(style["text_hex"]))
    number_font = _fit_font_size(
        pdf,
        text=identity.public_number_display,
        font_name="Helvetica-Bold",
        max_width=number_width,
        preferred_size=13,
    )
    number_y = (
        plate_y + plate_h - 10 * mm
        if style["number_position"] == "top"
        else plate_y + 6 * mm
    )
    pdf.setFont("Helvetica-Bold", number_font)
    pdf.drawString(number_left, number_y, identity.public_number_display)

    label_y = (
        plate_y + 6 * mm
        if style["number_position"] == "top"
        else plate_y + plate_h - 10 * mm
    )
    pdf.setFillColor(HexColor(style["accent_hex"]))
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(number_left, label_y, style["label"])

    pdf.setFillColor(HexColor("#4B5563"))
    pdf.setFont("Helvetica", 6)
    pdf.drawString(
        x + pad,
        y + 3.5 * mm,
        f"QR token: {identity.qr_token}",
    )


def render_official_manufacturing_pdf(
    *,
    lot_code: Any,
    category: Any,
    quantity: Any,
    template_snapshot: ManufacturingTemplateSnapshot,
    identities: Sequence[ManufacturingBeaconIdentity],
    site_origin: Any,
) -> bytes:
    lot_code_value = str(lot_code or "").strip()
    if not lot_code_value:
        raise ManufacturingRuntimeError("Code lot obligatoire.")

    try:
        quantity_value = int(quantity)
    except (TypeError, ValueError) as exc:
        raise ManufacturingRuntimeError("Quantité du lot invalide.") from exc

    if quantity_value <= 0:
        raise ManufacturingRuntimeError("Quantité du lot invalide.")

    try:
        normalized_category = normalize_category(category)
    except ManufacturingContractError as exc:
        raise ManufacturingRuntimeError(str(exc)) from exc

    if normalized_category != template_snapshot.category:
        raise ManufacturingRuntimeError(
            "Le modèle ne correspond pas à la catégorie du lot.",
            status="template_mismatch",
            http_status=409,
        )

    if len(identities) != quantity_value:
        raise ManufacturingRuntimeError(
            "La population du lot ne correspond pas à sa quantité.",
            status="lot_population_invalid",
            http_status=409,
        )

    for identity in identities:
        if identity.category != normalized_category:
            raise ManufacturingRuntimeError(
                "Une balise du lot possède une catégorie incohérente.",
                status="lot_population_invalid",
                http_status=409,
            )

    style = _supplier_pdf_style(template_snapshot)
    origin = _canonical_site_origin(site_origin)

    buffer = BytesIO()
    pdf = canvas.Canvas(
        buffer,
        pagesize=A4,
        pageCompression=1,
        invariant=1,
    )
    pdf.setTitle(f"Adresse GN - PDF fournisseur - {lot_code_value}")
    pdf.setAuthor("Adresse GN")
    pdf.setCreator("Adresse GN Django / ReportLab")
    pdf.setSubject("Document officiel de fabrication des balises")

    page_w, page_h = A4
    pdf.setFillColor(HexColor("#111827"))
    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(
        18 * mm,
        page_h - 22 * mm,
        "ADRESSE GN - DOCUMENT FOURNISSEUR OFFICIEL",
    )

    summary = [
        ("Lot", lot_code_value),
        ("Catégorie", normalized_category),
        ("Quantité", str(quantity_value)),
        (
            "Modèle",
            f"{template_snapshot.name} v{template_snapshot.version}",
        ),
        (
            "Dimensions",
            (
                f"{template_snapshot.width_mm} x "
                f"{template_snapshot.height_mm} mm"
            ),
        ),
        ("Matière", template_snapshot.material),
        ("Finition", template_snapshot.finish),
        ("Format numéro", NUMBER_FORMAT_VERSION),
        ("QR", "URL Adresse GN V1 + qr_token immuable de la balise"),
    ]

    cursor_y = page_h - 38 * mm
    for label, value in summary:
        pdf.setFont("Helvetica-Bold", 8)
        pdf.drawString(18 * mm, cursor_y, f"{label} :")
        pdf.setFont("Helvetica", 8)
        pdf.drawString(52 * mm, cursor_y, value)
        cursor_y -= 6 * mm

    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(18 * mm, cursor_y - 2 * mm, "Règles d'identité :")
    cursor_y -= 8 * mm

    for rule in (
        "Le numéro stocké et le qr_token existants ne sont jamais régénérés.",
        "Le numéro visible est uniquement formaté pour l'impression.",
        "Chaque QR incorpore le numéro V1 stocké et le qr_token immuable.",
        "Le snapshot complet du modèle est figé avec le document officiel.",
    ):
        cursor_y = _draw_wrapped_text(
            pdf,
            text=f"- {rule}",
            x=18 * mm,
            y=cursor_y,
            max_width=174 * mm,
            font_size=8,
            leading=10,
            max_lines=3,
        )
        cursor_y -= 2 * mm

    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(
        18 * mm,
        25 * mm,
        (
            "La spécification graphique complète du modèle "
            "est reproduite dans les pages suivantes."
        ),
    )
    pdf.showPage()

    spec_json = json.dumps(
        template_snapshot.artwork_spec,
        ensure_ascii=True,
        sort_keys=True,
        indent=2,
    )
    spec_lines = spec_json.splitlines()
    lines_per_page = 56

    for offset in range(0, len(spec_lines), lines_per_page):
        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawString(
            18 * mm,
            page_h - 20 * mm,
            (
                "Spécification graphique figée - "
                f"{template_snapshot.name} v{template_snapshot.version}"
            ),
        )
        pdf.setFont("Courier", 6.4)
        y = page_h - 30 * mm
        for line in spec_lines[offset:offset + lines_per_page]:
            pdf.drawString(18 * mm, y, line[:150])
            y -= 3.7 * mm
        pdf.showPage()

    columns = 2
    rows = 2
    cards_per_page = columns * rows
    margin_x = 12 * mm
    margin_y = 12 * mm
    gap = 5 * mm
    card_w = (page_w - 2 * margin_x - gap) / columns
    card_h = (page_h - 2 * margin_y - gap) / rows

    for index, identity in enumerate(identities):
        page_index = index % cards_per_page
        if index > 0 and page_index == 0:
            pdf.showPage()

        column = page_index % columns
        row = page_index // columns
        x = margin_x + column * (card_w + gap)
        y = page_h - margin_y - (row + 1) * card_h - row * gap

        payload = canonical_manufacturing_qr_payload(
            site_origin=origin,
            identity=identity,
        )
        _draw_plate_card(
            pdf,
            x=x,
            y=y,
            width=card_w,
            height=card_h,
            identity=identity,
            qr_payload=payload,
            snapshot=template_snapshot,
            style=style,
        )

    pdf.save()
    result = buffer.getvalue()

    if (
        not result.startswith(b"%PDF")
        or len(result) > MAX_MANUFACTURING_PDF_BYTES
    ):
        raise ManufacturingRuntimeError(
            "PDF fournisseur invalide ou supérieur à 25 MiB.",
            status="pdf_invalid",
            http_status=409,
        )

    return result


def _sign_document(
    *,
    document_id: str,
    lot_id: str,
    lot_code: str,
    storage_path: str,
    pdf_sha256: str,
    beacon_count: int,
    template_id: str,
    template_version: int,
    source: str,
) -> dict[str, Any]:
    try:
        signed_url = signed_storage_url(
            bucket=MANUFACTURING_BUCKET,
            storage_path=storage_path,
            expires_in=600,
        )
    except SupabaseExternalError as exc:
        raise ManufacturingRuntimeError(
            str(exc),
            status="external_error",
            http_status=502,
        ) from exc

    return {
        "ok": True,
        "status": "signed",
        "source": source,
        "document_id": document_id,
        "lot_id": lot_id,
        "lot_code": lot_code,
        "storage_path": storage_path,
        "pdf_sha256": pdf_sha256,
        "beacon_count": beacon_count,
        "template_id": template_id,
        "template_version": template_version,
        "signed_url": signed_url,
        "expires_in": 600,
    }



def _compensate_uploaded_manufacturing_pdf(
    *,
    uploaded: bool,
    storage_path: str,
) -> None:
    if not uploaded:
        return

    try:
        delete_storage_object(
            bucket=MANUFACTURING_BUCKET,
            storage_path=storage_path,
        )
    except Exception as cleanup_exc:
        raise ManufacturingRuntimeError(
            (
                "La compensation Storage du PDF fournisseur officiel a échoué. "
                f"Le chemin déterministe {storage_path} peut contenir "
                "un objet orphelin."
            ),
            status="storage_compensation_failed",
            http_status=502,
        ) from cleanup_exc


def get_or_create_official_manufacturing_pdf(
    *,
    actor_id: Any,
    lot_id: Any,
    origin_hint: Any = None,
) -> dict[str, Any]:
    clean_actor_id = str(actor_id or "").strip()
    clean_lot_id = str(lot_id or "").strip()

    if not clean_actor_id:
        raise ManufacturingRuntimeError(
            "Acteur obligatoire.",
            http_status=403,
        )

    try:
        storage_path = manufacturing_pdf_storage_path(lot_id=clean_lot_id)
    except ManufacturingContractError as exc:
        raise ManufacturingRuntimeError(str(exc)) from exc

    existing_result: dict[str, Any] | None = None
    created_result: dict[str, Any] | None = None
    uploaded = False

    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        id::text,
                        code,
                        quantity,
                        category,
                        status
                    FROM public.lots
                    WHERE id = %s
                    FOR UPDATE
                    """,
                    [clean_lot_id],
                )
                lot = cursor.fetchone()

                if not lot:
                    raise ManufacturingRuntimeError(
                        "Lot introuvable.",
                        status="not_found",
                        http_status=404,
                    )

                (
                    locked_lot_id,
                    lot_code,
                    quantity,
                    lot_category,
                    lot_status,
                ) = lot

                try:
                    normalized_category = normalize_category(lot_category)
                except ManufacturingContractError as exc:
                    raise ManufacturingRuntimeError(str(exc)) from exc

                cursor.execute(
                    """
                    SELECT
                        d.id::text,
                        d.category,
                        d.pdf_storage_path,
                        d.pdf_sha256,
                        d.beacon_count,
                        d.template_id::text,
                        d.template_version,
                        d.number_format_version
                    FROM public.lot_manufacturing_documents d
                    WHERE d.lot_id = %s
                    """,
                    [clean_lot_id],
                )
                existing = cursor.fetchone()

                if existing:
                    existing_category = str(existing[1])
                    existing_path = str(existing[2])
                    existing_hash = str(existing[3])
                    existing_count = int(existing[4])
                    existing_number_format = str(existing[7])

                    if (
                        existing_category != normalized_category
                        or existing_path != storage_path
                        or not re.fullmatch(r"[0-9a-f]{64}", existing_hash)
                        or existing_count != int(quantity)
                        or existing_number_format != NUMBER_FORMAT_VERSION
                    ):
                        raise ManufacturingRuntimeError(
                            "Le document fournisseur existant viole le contrat PROD-P1.",
                            status="document_contract_invalid",
                            http_status=409,
                        )

                    existing_result = {
                        "document_id": str(existing[0]),
                        "lot_id": str(locked_lot_id),
                        "lot_code": str(lot_code),
                        "storage_path": existing_path,
                        "pdf_sha256": existing_hash,
                        "beacon_count": existing_count,
                        "template_id": str(existing[5]),
                        "template_version": int(existing[6]),
                    }
                else:
                    if str(lot_status) != "generated":
                        raise ManufacturingRuntimeError(
                            (
                                "La première génération du PDF fournisseur "
                                "est autorisée uniquement pour un lot "
                                "au statut generated."
                            ),
                            status="lot_state_invalid",
                            http_status=409,
                        )

                    try:
                        quantity_value = int(quantity)
                    except (TypeError, ValueError) as exc:
                        raise ManufacturingRuntimeError(
                            "Quantité du lot invalide.",
                            status="lot_population_invalid",
                            http_status=409,
                        ) from exc

                    if quantity_value <= 0:
                        raise ManufacturingRuntimeError(
                            "Quantité du lot invalide.",
                            status="lot_population_invalid",
                            http_status=409,
                        )

                    cursor.execute(
                        """
                        SELECT
                            id::text,
                            category,
                            version,
                            name,
                            width_mm,
                            height_mm,
                            material,
                            finish,
                            artwork_spec
                        FROM public.beacon_manufacturing_templates
                        WHERE
                            category = %s
                            AND active IS TRUE
                        ORDER BY version DESC
                        LIMIT 2
                        FOR SHARE
                        """,
                        [normalized_category],
                    )
                    templates = cursor.fetchall()

                    if len(templates) != 1:
                        raise ManufacturingRuntimeError(
                            (
                                "Un modèle physique actif unique est "
                                "obligatoire pour ce type de balise."
                            ),
                            status="template_missing",
                            http_status=409,
                        )

                    template = templates[0]
                    artwork_spec = _normalize_artwork_spec(template[8])
                    snapshot = freeze_template_snapshot(
                        template_id=template[0],
                        category=template[1],
                        version=template[2],
                        name=template[3],
                        width_mm=template[4],
                        height_mm=template[5],
                        material=template[6],
                        finish=template[7],
                        artwork_spec=artwork_spec,
                    )

                    cursor.execute(
                        """
                        SELECT
                            public_number,
                            qr_token::text,
                            category,
                            numbering_version
                        FROM public.beacons
                        WHERE lot_id = %s
                        ORDER BY public_number
                        FOR SHARE
                        """,
                        [clean_lot_id],
                    )
                    beacon_rows = cursor.fetchall()

                    if len(beacon_rows) != quantity_value:
                        raise ManufacturingRuntimeError(
                            (
                                "Le nombre de balises V1 du lot ne "
                                "correspond pas à la quantité du lot."
                            ),
                            status="lot_population_invalid",
                            http_status=409,
                        )

                    identities: list[ManufacturingBeaconIdentity] = []
                    for (
                        public_number,
                        qr_token,
                        beacon_category,
                        numbering_version,
                    ) in beacon_rows:
                        if str(numbering_version) != "v1":
                            raise ManufacturingRuntimeError(
                                (
                                    "Le PDF fournisseur officiel "
                                    "est réservé aux balises V1."
                                ),
                                status="legacy_beacon_rejected",
                                http_status=409,
                            )

                        identity = manufacturing_beacon_identity(
                            public_number=public_number,
                            qr_token=qr_token,
                            category=beacon_category,
                        )

                        if identity.category != normalized_category:
                            raise ManufacturingRuntimeError(
                                (
                                    "Catégorie de balise incohérente "
                                    "dans le lot."
                                ),
                                status="lot_population_invalid",
                                http_status=409,
                            )
                        identities.append(identity)

                    origin = _canonical_site_origin(
                        public_site_url(
                            str(origin_hint or "").strip() or None
                        )
                    )
                    pdf_bytes = render_official_manufacturing_pdf(
                        lot_code=lot_code,
                        category=normalized_category,
                        quantity=quantity_value,
                        template_snapshot=snapshot,
                        identities=identities,
                        site_origin=origin,
                    )
                    pdf_hash = sha256_pdf(pdf_bytes)

                    try:
                        upload_storage_object(
                            bucket=MANUFACTURING_BUCKET,
                            storage_path=storage_path,
                            content=pdf_bytes,
                            content_type="application/pdf",
                        )
                    except SupabaseExternalError as exc:
                        raise ManufacturingRuntimeError(
                            str(exc),
                            status="external_error",
                            http_status=502,
                        ) from exc

                    uploaded = True
                    snapshot_json = json.dumps(
                        asdict(snapshot),
                        ensure_ascii=False,
                        sort_keys=True,
                    )

                    cursor.execute(
                        """
                        INSERT INTO public.lot_manufacturing_documents (
                            lot_id,
                            category,
                            template_id,
                            template_version,
                            template_snapshot,
                            pdf_storage_path,
                            pdf_sha256,
                            beacon_count,
                            number_format_version,
                            generated_by
                        )
                        VALUES (
                            %s, %s, %s, %s, %s::jsonb,
                            %s, %s, %s, %s, %s
                        )
                        RETURNING id::text
                        """,
                        [
                            clean_lot_id,
                            normalized_category,
                            snapshot.template_id,
                            snapshot.version,
                            snapshot_json,
                            storage_path,
                            pdf_hash,
                            quantity_value,
                            NUMBER_FORMAT_VERSION,
                            clean_actor_id,
                        ],
                    )
                    document_id = str(cursor.fetchone()[0])

                    audit(
                        cursor,
                        actor_id=clean_actor_id,
                        action="manufacturing.pdf.generate",
                        entity="lot_manufacturing_documents",
                        entity_id=document_id,
                        after={
                            "lot_id": clean_lot_id,
                            "lot_code": str(lot_code),
                            "category": normalized_category,
                            "template_id": snapshot.template_id,
                            "template_version": snapshot.version,
                            "pdf_storage_path": storage_path,
                            "pdf_sha256": pdf_hash,
                            "beacon_count": quantity_value,
                            "number_format_version": NUMBER_FORMAT_VERSION,
                        },
                    )

                    created_result = {
                        "document_id": document_id,
                        "lot_id": str(locked_lot_id),
                        "lot_code": str(lot_code),
                        "storage_path": storage_path,
                        "pdf_sha256": pdf_hash,
                        "beacon_count": quantity_value,
                        "template_id": snapshot.template_id,
                        "template_version": snapshot.version,
                    }

    except ManufacturingRuntimeError:
        _compensate_uploaded_manufacturing_pdf(
            uploaded=uploaded,
            storage_path=storage_path,
        )
        raise
    except ManufacturingContractError as exc:
        _compensate_uploaded_manufacturing_pdf(
            uploaded=uploaded,
            storage_path=storage_path,
        )
        raise ManufacturingRuntimeError(
            str(exc),
            status="manufacturing_contract",
            http_status=409,
        ) from exc
    except Exception as exc:
        _compensate_uploaded_manufacturing_pdf(
            uploaded=uploaded,
            storage_path=storage_path,
        )
        raise ManufacturingRuntimeError(
            "Impossible de créer le PDF fournisseur officiel.",
            status="generation_error",
            http_status=500,
        ) from exc

    if existing_result is not None:
        return _sign_document(
            **existing_result,
            source="existing",
        )

    if created_result is None:
        raise ManufacturingRuntimeError(
            "Le document fournisseur n’a pas été créé.",
            status="generation_error",
            http_status=500,
        )

    return _sign_document(
        **created_result,
        source="created",
    )
