from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import re
from decimal import Decimal, InvalidOperation
from typing import Any

from numbering import NumberingError, format_v1_public_number

MANUFACTURING_BUCKET = "manufacturing-pdfs"
NUMBER_FORMAT_VERSION = "v1-display-1"
PHYSICAL_BEACON_CATEGORIES = frozenset({
    "residential",
    "residential_plus",
    "professional",
    "institutional",
    "custom",
})

class ManufacturingContractError(RuntimeError):
    pass

@dataclass(frozen=True)
class ManufacturingBeaconIdentity:
    public_number_stored: str
    public_number_display: str
    qr_token: str
    category: str

@dataclass(frozen=True)
class ManufacturingTemplateSnapshot:
    template_id: str
    category: str
    version: int
    name: str
    width_mm: str
    height_mm: str
    material: str
    finish: str
    artwork_spec: dict[str, Any]

def normalize_category(value: Any) -> str:
    category = str(value or "").strip().lower()
    if category not in PHYSICAL_BEACON_CATEGORIES:
        raise ManufacturingContractError("Type physique de balise invalide.")
    return category

def manufacturing_beacon_identity(*, public_number: Any, qr_token: Any, category: Any) -> ManufacturingBeaconIdentity:
    stored = str(public_number or "").strip().upper()
    qr = str(qr_token or "").strip()
    if not qr:
        raise ManufacturingContractError("Identité QR de balise obligatoire.")
    try:
        display = format_v1_public_number(stored)
    except NumberingError as exc:
        raise ManufacturingContractError(str(exc)) from exc
    return ManufacturingBeaconIdentity(
        public_number_stored=stored,
        public_number_display=display,
        qr_token=qr,
        category=normalize_category(category),
    )

def manufacturing_pdf_storage_path(*, lot_id: Any) -> str:
    value = str(lot_id or "").strip().lower()
    if not re.fullmatch(
        r"[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}",
        value,
    ):
        raise ManufacturingContractError("Identifiant de lot invalide.")
    return f"lots/{value}/official-manufacturing.pdf"

def _canonical_dimension(
    value: Any,
) -> str:
    try:
        decimal_value = Decimal(
            str(value or "").strip()
        )
    except (
        InvalidOperation,
        ValueError,
    ) as exc:
        raise ManufacturingContractError(
            "Dimension de modèle invalide."
        ) from exc

    if decimal_value <= 0:
        raise ManufacturingContractError(
            "Dimension de modèle invalide."
        )

    return format(
        decimal_value.quantize(
            Decimal("0.01")
        ),
        "f",
    )


def freeze_template_snapshot(
    *,
    template_id: Any,
    category: Any,
    version: Any,
    name: Any,
    width_mm: Any,
    height_mm: Any,
    material: Any,
    finish: Any,
    artwork_spec: Any,
) -> ManufacturingTemplateSnapshot:
    try:
        version_int = int(version)
    except (TypeError, ValueError) as exc:
        raise ManufacturingContractError("Version de modèle invalide.") from exc
    if version_int <= 0:
        raise ManufacturingContractError("Version de modèle invalide.")
    values = [
        str(template_id or "").strip(),
        str(name or "").strip(),
        _canonical_dimension(width_mm),
        _canonical_dimension(height_mm),
        str(material or "").strip(),
        str(finish or "").strip(),
    ]
    if not all(values):
        raise ManufacturingContractError(
            "Un modèle actif doit définir identité, dimensions, matière et finition."
        )
    if not isinstance(artwork_spec, dict) or not artwork_spec:
        raise ManufacturingContractError("Spécification graphique obligatoire.")
    frozen = json.loads(json.dumps(artwork_spec, ensure_ascii=False, sort_keys=True))
    return ManufacturingTemplateSnapshot(
        template_id=values[0],
        category=normalize_category(category),
        version=version_int,
        name=values[1],
        width_mm=values[2],
        height_mm=values[3],
        material=values[4],
        finish=values[5],
        artwork_spec=frozen,
    )

def sha256_pdf(pdf_bytes: bytes) -> str:
    if not isinstance(pdf_bytes, bytes) or not pdf_bytes:
        raise ManufacturingContractError("PDF de fabrication vide ou invalide.")
    return hashlib.sha256(pdf_bytes).hexdigest().lower()
