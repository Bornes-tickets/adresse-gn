from __future__ import annotations

import re
from typing import Any


class NumberingError(RuntimeError):
    pass


_VERHOEFF_D = (
    (0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
    (1, 2, 3, 4, 0, 6, 7, 8, 9, 5),
    (2, 3, 4, 0, 1, 7, 8, 9, 5, 6),
    (3, 4, 0, 1, 2, 8, 9, 5, 6, 7),
    (4, 0, 1, 2, 3, 9, 5, 6, 7, 8),
    (5, 9, 8, 7, 6, 0, 4, 3, 2, 1),
    (6, 5, 9, 8, 7, 1, 0, 4, 3, 2),
    (7, 6, 5, 9, 8, 2, 1, 0, 4, 3),
    (8, 7, 6, 5, 9, 3, 2, 1, 0, 4),
    (9, 8, 7, 6, 5, 4, 3, 2, 1, 0),
)

_VERHOEFF_P = (
    (0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
    (1, 5, 7, 6, 2, 8, 3, 0, 9, 4),
    (5, 8, 0, 3, 7, 9, 6, 1, 4, 2),
    (8, 9, 1, 6, 0, 4, 3, 5, 2, 7),
    (9, 4, 5, 3, 1, 2, 6, 8, 7, 0),
    (4, 2, 8, 6, 5, 7, 3, 9, 0, 1),
    (2, 7, 9, 3, 8, 0, 6, 4, 1, 5),
    (7, 0, 4, 6, 9, 1, 3, 2, 5, 8),
)

_VERHOEFF_INV = (
    0, 4, 3, 2, 1, 5, 6, 7, 8, 9
)


def validate_commune_code(commune_code: Any) -> str:
    value = str(commune_code or "").strip().upper()

    if not re.fullmatch(r"[A-Z]{3}[0-9]{2}", value):
        raise NumberingError(
            "Code officiel de commune invalide."
        )

    return value


def verhoeff_check_digit(national_id: Any) -> str:
    value = str(national_id or "").strip()

    if not re.fullmatch(r"[0-9]{8}", value):
        raise NumberingError(
            "Identifiant national Adresse GN invalide."
        )

    checksum = 0

    for index, digit in enumerate(reversed(value)):
        checksum = _VERHOEFF_D[
            checksum
        ][
            _VERHOEFF_P[
                (index + 1) % 8
            ][int(digit)]
        ]

    return str(_VERHOEFF_INV[checksum])


def next_v1_beacon_number(
    cursor,
    *,
    commune_code: str,
) -> dict[str, str]:
    clean_commune_code = validate_commune_code(
        commune_code
    )

    cursor.execute(
        """
        SELECT nextval(
            'public.address_national_id_seq'
        )
        """
    )

    row = cursor.fetchone()

    if not row:
        raise NumberingError(
            "Séquence nationale Adresse GN indisponible."
        )

    national_value = int(row[0])

    if (
        national_value < 10_000_000
        or national_value > 99_999_999
    ):
        raise NumberingError(
            "Plage nationale Adresse GN épuisée."
        )

    national_id = f"{national_value:08d}"
    check_digit = verhoeff_check_digit(
        national_id
    )

    public_number = (
        f"{clean_commune_code}-"
        f"{national_id}"
        f"{check_digit}"
    )

    return {
        "public_number": public_number,
        "national_id": national_id,
        "check_digit": check_digit,
        "commune_code_at_issue": clean_commune_code,
        "numbering_version": "v1",
    }
