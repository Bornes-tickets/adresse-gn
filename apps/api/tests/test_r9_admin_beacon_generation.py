from __future__ import annotations

import sys
from pathlib import Path
from unittest import TestCase, main


API_ROOT = Path(__file__).resolve().parents[1]

if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))


from numbering import (  # noqa: E402
    NumberingError,
    next_v1_beacon_number,
    validate_commune_code,
    verhoeff_check_digit,
)


class FakeCursor:

    def __init__(self, value: int) -> None:
        self.value = value
        self.executed = []

    def execute(self, sql, params=None) -> None:
        self.executed.append(
            (" ".join(str(sql).split()), params)
        )

    def fetchone(self):
        return (self.value,)


class R9AdminBeaconGenerationTests(TestCase):

    def test_reference_verhoeff_values(self) -> None:
        cases = {
            "58274136": "9",
            "10000000": "0",
            "10000001": "6",
            "10000002": "8",
            "10000003": "7",
        }

        for value, expected in cases.items():
            with self.subTest(value=value):
                self.assertEqual(
                    verhoeff_check_digit(value),
                    expected,
                )

    def test_commune_code_is_normalized(self) -> None:
        self.assertEqual(
            validate_commune_code(" bfa01 "),
            "BFA01",
        )

    def test_invalid_commune_code_is_rejected(self) -> None:
        with self.assertRaises(NumberingError):
            validate_commune_code("BFA")

    def test_next_v1_number_uses_national_sequence(
        self,
    ) -> None:
        cursor = FakeCursor(10_000_000)

        result = next_v1_beacon_number(
            cursor,
            commune_code="BFA01",
        )

        self.assertEqual(
            result,
            {
                "public_number": "BFA01-100000000",
                "national_id": "10000000",
                "check_digit": "0",
                "commune_code_at_issue": "BFA01",
                "numbering_version": "v1",
            },
        )

        self.assertEqual(len(cursor.executed), 1)
        self.assertIn(
            "address_national_id_seq",
            cursor.executed[0][0],
        )

    def test_sequence_range_is_guarded(self) -> None:
        cursor = FakeCursor(100_000_000)

        with self.assertRaises(NumberingError):
            next_v1_beacon_number(
                cursor,
                commune_code="BFA01",
            )


if __name__ == "__main__":
    main()
