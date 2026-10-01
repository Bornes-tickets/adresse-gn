from unittest import TestCase

from addresses.numbering import (
    BEACON_REGEX,
    V1_BEACON_REGEX,
    is_valid_address_number,
    normalize_address_number,
)
from owner_portal.services import (
    _normalize_favorite_number,
)


class AddressNumberV1OnlyTests(TestCase):

    def test_v1_canonical_is_preserved(self):
        self.assertEqual(
            normalize_address_number(
                "BFA01-100000000"
            ),
            "BFA01-100000000",
        )

    def test_v1_lowercase_is_normalized(self):
        self.assertEqual(
            normalize_address_number(
                "bfa01-100000000"
            ),
            "BFA01-100000000",
        )

    def test_v1_compact_is_normalized(self):
        self.assertEqual(
            normalize_address_number(
                "BFA01100000000"
            ),
            "BFA01-100000000",
        )

    def test_v1_grouped_is_normalized(self):
        self.assertEqual(
            normalize_address_number(
                "BFA01-100 000 000"
            ),
            "BFA01-100000000",
        )

    def test_v1_regex_accepts_canonical(self):
        value = "CKY08-100000000"

        self.assertIsNotNone(
            V1_BEACON_REGEX.fullmatch(
                value
            )
        )

        self.assertIsNotNone(
            BEACON_REGEX.fullmatch(
                value
            )
        )

        self.assertTrue(
            is_valid_address_number(
                value
            )
        )

    def test_legacy_formats_are_rejected(self):
        values = (
            "GN-CKY-582741",
            "GNCKY582741",
            "582741",
        )

        for value in values:
            with self.subTest(
                value=value
            ):
                normalized = (
                    normalize_address_number(
                        value
                    )
                )

                self.assertFalse(
                    is_valid_address_number(
                        normalized
                    )
                )

                self.assertIsNone(
                    BEACON_REGEX.fullmatch(
                        normalized
                    )
                )

    def test_nine_digits_alone_are_rejected(self):
        normalized = (
            normalize_address_number(
                "100000000"
            )
        )

        self.assertEqual(
            normalized,
            "100000000",
        )

        self.assertFalse(
            is_valid_address_number(
                normalized
            )
        )

    def test_invalid_v1_values_are_rejected(self):
        values = (
            "",
            "BFA01-10000000",
            "BFA01-1000000000",
            "BFA1-100000000",
            "BFA001-100000000",
        )

        for value in values:
            with self.subTest(
                value=value
            ):
                normalized = (
                    normalize_address_number(
                        value
                    )
                )

                self.assertFalse(
                    is_valid_address_number(
                        normalized
                    )
                )

    def test_owner_favorite_reuses_v1_normalizer(self):
        self.assertEqual(
            _normalize_favorite_number(
                "BFA01-100 000 000"
            ),
            "BFA01-100000000",
        )

    def test_owner_favorite_does_not_convert_legacy(self):
        value = (
            _normalize_favorite_number(
                "GN-CKY-582741"
            )
        )

        self.assertFalse(
            is_valid_address_number(
                value
            )
        )