from __future__ import annotations

import re


V1_BEACON_REGEX = re.compile(
    r"^[A-Z]{3}\d{2}-\d{9}$"
)

BEACON_REGEX = V1_BEACON_REGEX


def normalize_address_number(
    value: str,
) -> str:
    """
    Normalise un numéro Adresse GN V1.

    Format canonique :
    CCCCC-NNNNNNNNC

    Exemple :
    CKY04-582741369
    """

    raw = str(
        value
        or ""
    ).strip().upper()

    if not raw:
        return ""

    compact = re.sub(
        r"[^A-Z0-9]",
        "",
        raw,
    )

    v1_match = re.fullmatch(
        r"([A-Z]{3}\d{2})(\d{9})",
        compact,
    )

    if v1_match:
        return (
            f"{v1_match.group(1)}-"
            f"{v1_match.group(2)}"
        )

    return raw


def is_valid_address_number(
    value: str,
) -> bool:
    return bool(
        V1_BEACON_REGEX.fullmatch(
            value
        )
    )
