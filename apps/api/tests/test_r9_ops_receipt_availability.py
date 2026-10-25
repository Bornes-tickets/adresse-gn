from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest import TestCase, main
from unittest.mock import patch


API_ROOT = Path(__file__).resolve().parents[1]

if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "config.settings",
)

import django  # noqa: E402

django.setup()


from backoffice.action_common import ActionError  # noqa: E402
from backoffice.action_ops import generate_dn  # noqa: E402


class FakeCursor:

    def __init__(
        self,
        *,
        lot_quantity: int = 10,
        lot_status: str = "shipped",
        po_status: str = "sent",
        accepted_before: int = 0,
        beacon_ids: list[str] | None = None,
    ) -> None:
        self.lot_quantity = lot_quantity
        self.lot_status = lot_status
        self.po_status = po_status
        self.accepted_before = accepted_before
        self.beacon_ids = list(beacon_ids or [])
        self.executed = []
        self._fetchone = None
        self._fetchall = []
        self.rowcount = 0

    def execute(
        self,
        sql,
        params=None,
    ) -> None:
        normalized = " ".join(str(sql).split())
        self.executed.append((normalized, params))
        self.rowcount = 0

        if (
            "FROM public.lots" in normalized
            and "FOR UPDATE" in normalized
        ):
            self._fetchone = (
                "lot-id",
                "LOT-R9",
                self.lot_quantity,
                "Supplier",
                self.lot_status,
            )
            return

        if (
            "FROM public.purchase_orders" in normalized
            and "FOR UPDATE" in normalized
        ):
            self._fetchone = (
                "po-id",
                {"name": "Supplier"},
                self.po_status,
            )
            return

        if (
            "SUM(quantity_received)" in normalized
            and "public.delivery_notes" in normalized
        ):
            self._fetchone = (self.accepted_before,)
            return

        if (
            "SELECT id::text" in normalized
            and "FROM public.beacons" in normalized
        ):
            limit = int(params[1])
            self._fetchall = [
                (value,)
                for value in self.beacon_ids[:limit]
            ]
            return

        if "INSERT INTO public.delivery_notes" in normalized:
            self._fetchone = ("dn-id",)
            return

        if "UPDATE public.beacons" in normalized:
            self.rowcount = len(params[0])
            return

        self._fetchone = None

    def fetchone(self):
        return self._fetchone

    def fetchall(self):
        return list(self._fetchall)

    def __enter__(self):
        return self

    def __exit__(
        self,
        exc_type,
        exc,
        traceback,
    ):
        return False


def sql_calls(cursor: FakeCursor) -> list[str]:
    return [
        sql
        for sql, _ in cursor.executed
    ]


class R9OpsReceiptAvailabilityTests(TestCase):

    actor = {
        "user_id":
            "11111111-1111-1111-1111-111111111111",
        "role":
            "ops",
    }

    def execute_with(
        self,
        cursor: FakeCursor,
        data: dict,
    ):
        with patch(
            "backoffice.action_ops.connection.cursor",
            return_value=cursor,
        ):
            with patch(
                "backoffice.action_ops.next_db_number",
                return_value="BL-TEST-0001",
            ):
                with patch(
                    "backoffice.action_ops.audit"
                ):
                    return generate_dn(
                        self.actor,
                        "lot-id",
                        data,
                    )

    def test_cumulative_qc_receipt_overage_is_rejected(
        self,
    ) -> None:
        cursor = FakeCursor(
            lot_quantity=100,
            accepted_before=60,
            beacon_ids=[
                f"00000000-0000-0000-0000-{index:012d}"
                for index in range(1, 51)
            ],
        )

        with self.assertRaises(ActionError) as context:
            self.execute_with(
                cursor,
                {
                    "quantity_received": 50,
                    "qc_passed": True,
                },
            )

        self.assertEqual(
            context.exception.status,
            "receipt_overage",
        )

        self.assertFalse(
            any(
                "INSERT INTO public.delivery_notes" in sql
                for sql in sql_calls(cursor)
            )
        )

    def test_qc_failure_releases_no_beacon(
        self,
    ) -> None:
        cursor = FakeCursor(
            lot_quantity=10,
            accepted_before=3,
            beacon_ids=[
                "00000000-0000-0000-0000-000000000001",
            ],
        )

        result = self.execute_with(
            cursor,
            {
                "quantity_received": 2,
                "qc_passed": False,
                "defects": "Plaques non conformes",
            },
        )

        self.assertEqual(
            result["quantity_available"],
            0,
        )
        self.assertEqual(
            result["accepted_total"],
            3,
        )
        self.assertFalse(
            any(
                "UPDATE public.beacons" in sql
                for sql in sql_calls(cursor)
            )
        )

    def test_partial_qc_pass_releases_exact_quantity(
        self,
    ) -> None:
        cursor = FakeCursor(
            lot_quantity=10,
            accepted_before=2,
            beacon_ids=[
                "00000000-0000-0000-0000-000000000001",
                "00000000-0000-0000-0000-000000000002",
                "00000000-0000-0000-0000-000000000003",
            ],
        )

        result = self.execute_with(
            cursor,
            {
                "quantity_received": 3,
                "qc_passed": True,
            },
        )

        self.assertEqual(
            result["quantity_available"],
            3,
        )
        self.assertEqual(
            result["accepted_total"],
            5,
        )
        self.assertEqual(
            result["quantity_remaining"],
            5,
        )
        self.assertEqual(
            result["lot_status"],
            "shipped",
        )

        statements = sql_calls(cursor)
        self.assertTrue(
            any(
                "status = 'available'" in sql
                for sql in statements
            )
        )
        self.assertFalse(
            any(
                "UPDATE public.lots" in sql
                and "status = 'received'" in sql
                for sql in statements
            )
        )

    def test_complete_qc_receipt_marks_lot_received(
        self,
    ) -> None:
        cursor = FakeCursor(
            lot_quantity=10,
            accepted_before=7,
            beacon_ids=[
                "00000000-0000-0000-0000-000000000001",
                "00000000-0000-0000-0000-000000000002",
                "00000000-0000-0000-0000-000000000003",
            ],
        )

        result = self.execute_with(
            cursor,
            {
                "quantity_received": 3,
                "qc_passed": True,
            },
        )

        self.assertEqual(
            result["accepted_total"],
            10,
        )
        self.assertEqual(
            result["quantity_remaining"],
            0,
        )
        self.assertEqual(
            result["lot_status"],
            "received",
        )

        self.assertTrue(
            any(
                "UPDATE public.lots" in sql
                and "status = 'received'" in sql
                for sql in sql_calls(cursor)
            )
        )

    def test_insufficient_generated_v1_stock_is_rejected(
        self,
    ) -> None:
        cursor = FakeCursor(
            lot_quantity=10,
            accepted_before=0,
            beacon_ids=[
                "00000000-0000-0000-0000-000000000001",
            ],
        )

        with self.assertRaises(ActionError) as context:
            self.execute_with(
                cursor,
                {
                    "quantity_received": 2,
                    "qc_passed": True,
                },
            )

        self.assertEqual(
            context.exception.status,
            "stock_mismatch",
        )


if __name__ == "__main__":
    main()
