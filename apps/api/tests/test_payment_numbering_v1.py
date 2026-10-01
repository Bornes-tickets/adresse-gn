import inspect
from unittest import TestCase
from unittest.mock import patch

from payments.services import (
    SalesPaymentFulfillmentError,
    _fulfill_digital_address,
    _next_v1_beacon_number,
    _resolve_site_commune,
    _verhoeff_check_digit,
    confirm_manual_payment_core,
)


class FakeCursor:
    def __init__(
        self,
        *,
        row=None,
        fetchone_results=None,
    ):
        self.row = row
        self.executed = []
        self.fetchone_results = list(
            fetchone_results or []
        )

    def execute(
        self,
        sql,
        params=None,
    ):
        self.executed.append(
            (
                " ".join(sql.split()),
                params,
            )
        )

    def fetchone(self):
        if self.fetchone_results:
            return self.fetchone_results.pop(0)

        return self.row

    def __enter__(self):
        return self

    def __exit__(
        self,
        exc_type,
        exc,
        traceback,
    ):
        return False


class PaymentNumberingV1Tests(TestCase):

    def test_verhoeff_reference_and_sequence_start(self):
        cases = {
            "58274136": "9",
            "10000000": "0",
            "10000001": "6",
            "10000002": "8",
            "10000003": "7",
        }

        for national_id, expected in cases.items():
            with self.subTest(
                national_id=national_id
            ):
                self.assertEqual(
                    _verhoeff_check_digit(
                        national_id
                    ),
                    expected,
                )

    def test_next_v1_number_uses_sequence_and_formats_number(self):
        fake = FakeCursor(
            row=(10000000,)
        )

        with patch(
            "payments.services.connection.cursor",
            return_value=fake,
        ):
            result = _next_v1_beacon_number(
                commune_code="BFA01"
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

        self.assertEqual(
            len(fake.executed),
            1,
        )

        self.assertIn(
            "nextval",
            fake.executed[0][0].lower(),
        )

        self.assertIn(
            "address_national_id_seq",
            fake.executed[0][0],
        )

    def test_invalid_direct_commune_code_is_rejected_before_sql(self):
        with patch(
            "payments.services.connection.cursor"
        ) as cursor_mock:
            with self.assertRaises(
                SalesPaymentFulfillmentError
            ):
                _next_v1_beacon_number(
                    commune_code="BFA"
                )

        cursor_mock.assert_not_called()

    def test_active_commune_returns_official_code(self):
        commune_id = (
            "00000000-0000-0000-0000-000000000001"
        )

        fake = FakeCursor(
            row=(
                commune_id,
                True,
                "BFA01",
            )
        )

        with patch(
            "payments.services.connection.cursor",
            return_value=fake,
        ):
            result = _resolve_site_commune(
                commune_id=commune_id
            )

        self.assertEqual(
            result,
            {
                "commune_id": commune_id,
                "commune_code": "BFA01",
            },
        )

    def test_inactive_commune_is_rejected(self):
        fake = FakeCursor(
            row=(
                "00000000-0000-0000-0000-000000000002",
                False,
                "BFA02",
            )
        )

        with patch(
            "payments.services.connection.cursor",
            return_value=fake,
        ):
            with self.assertRaises(
                SalesPaymentFulfillmentError
            ):
                _resolve_site_commune(
                    commune_id=(
                        "00000000-0000-0000-0000-000000000002"
                    )
                )

    def test_invalid_official_commune_code_is_rejected(self):
        fake = FakeCursor(
            row=(
                "00000000-0000-0000-0000-000000000003",
                True,
                "BFA",
            )
        )

        with patch(
            "payments.services.connection.cursor",
            return_value=fake,
        ):
            with self.assertRaises(
                SalesPaymentFulfillmentError
            ):
                _resolve_site_commune(
                    commune_id=(
                        "00000000-0000-0000-0000-000000000003"
                    )
                )

    def test_digital_fulfillment_inserts_v1_numbering_fields(self):
        fake = FakeCursor(
            fetchone_results=[
                (
                    "11111111-1111-1111-1111-111111111111",
                ),
                (
                    "22222222-2222-2222-2222-222222222222",
                ),
            ]
        )

        numbering = {
            "public_number": "BFA01-100000000",
            "national_id": "10000000",
            "check_digit": "0",
            "commune_code_at_issue": "BFA01",
            "numbering_version": "v1",
        }

        site = {
            "id": (
                "33333333-3333-3333-3333-333333333333"
            ),
            "requested_location": "POINT(-13.7 9.5)",
            "beacon_id": None,
            "place_type": "other",
        }

        with patch(
            "payments.services._next_v1_beacon_number",
            return_value=numbering,
        ) as generator:
            with patch(
                "payments.services.connection.cursor",
                return_value=fake,
            ):
                result = _fulfill_digital_address(
                    order_id=(
                        "44444444-4444-4444-4444-444444444444"
                    ),
                    order_ref="ORD-V1-TEST",
                    customer_id=(
                        "55555555-5555-5555-5555-555555555555"
                    ),
                    site=site,
                    commune_code="BFA01",
                )

        generator.assert_called_once_with(
            commune_code="BFA01"
        )

        self.assertEqual(
            result["public_number"],
            "BFA01-100000000",
        )

        self.assertEqual(
            len(fake.executed),
            4,
        )

        beacon_sql, beacon_params = (
            fake.executed[0]
        )

        for expected_sql in (
            "national_id",
            "check_digit",
            "commune_code_at_issue",
            "numbering_version",
            "'v1'",
        ):
            self.assertIn(
                expected_sql,
                beacon_sql,
            )

        self.assertEqual(
            beacon_params,
            [
                "BFA01-100000000",
                "10000000",
                "0",
                "BFA01",
            ],
        )

    def test_digital_fulfillment_guards_run_before_number_allocation(self):
        site = {
            "id": "site",
            "requested_location": None,
            "beacon_id": None,
            "place_type": "other",
        }

        with patch(
            "payments.services._next_v1_beacon_number"
        ) as generator:
            with self.assertRaises(
                SalesPaymentFulfillmentError
            ):
                _fulfill_digital_address(
                    order_id="order",
                    order_ref="ORD",
                    customer_id="customer",
                    site=site,
                    commune_code="BFA01",
                )

        generator.assert_not_called()

    def test_manual_confirmation_orchestrator_is_commune_based(self):
        source = inspect.getsource(
            confirm_manual_payment_core
        )

        self.assertIn(
            "_resolve_site_commune",
            source,
        )

        self.assertIn(
            'commune["commune_code"]',
            source,
        )

        self.assertIn(
            "commune_code=",
            source,
        )

        self.assertNotIn(
            "_resolve_site_region",
            source,
        )

        self.assertNotIn(
            'region["region_code"]',
            source,
        )

        self.assertNotIn(
            "region_code=",
            source,
        )
