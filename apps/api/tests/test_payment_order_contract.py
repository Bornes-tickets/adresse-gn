import json
from unittest import TestCase
from unittest.mock import patch

from payments.services import (
    _normalize_order_items,
    get_payment_order,
)


ITEMS = [
    {
        "qty": 1,
        "ref": "numerique",
        "code": "numerique",
        "label": "Numérique seule",
        "unit_price_gnf": 40000,
        "fulfillment_kind": "digital_address",
    }
]


class PaymentOrderContractTests(TestCase):

    def test_existing_normalizer_decodes_driver_json_string(self):
        result = _normalize_order_items(
            json.dumps(
                ITEMS
            )
        )

        self.assertIsInstance(
            result,
            list,
        )

        self.assertEqual(
            result,
            ITEMS,
        )

    def test_existing_normalizer_keeps_list_contract(self):
        result = _normalize_order_items(
            ITEMS
        )

        self.assertIsInstance(
            result,
            list,
        )

        self.assertEqual(
            result,
            ITEMS,
        )

    def test_get_payment_order_returns_items_as_list_when_driver_returns_string(self):
        order = {
            "id": "11111111-1111-1111-1111-111111111111",
            "order_ref": "ORD-TEST-0001",
            "customer_id": "22222222-2222-2222-2222-222222222222",
            "offer_code": "numerique",
            "amount_gnf": 40000,
            "status": "pending",
            "items": json.dumps(
                ITEMS
            ),
            "payment_method": "manual",
            "devis_demande": False,
            "created_at": "2026-10-09T00:00:00Z",
        }

        with patch(
            "payments.services._load_owned_order",
            return_value=order,
        ):
            with patch(
                "payments.services._latest_payment",
                return_value=None,
            ):
                with patch(
                    "payments.services._latest_invoice",
                    return_value=None,
                ):
                    result = get_payment_order(
                        user_id=order["customer_id"],
                        order_ref=order["order_ref"],
                    )

        self.assertIsInstance(
            result["items"],
            list,
        )

        self.assertEqual(
            result["items"],
            ITEMS,
        )

    def test_get_payment_order_preserves_empty_items_contract(self):
        order = {
            "id": "11111111-1111-1111-1111-111111111111",
            "order_ref": "ORD-TEST-0002",
            "customer_id": "22222222-2222-2222-2222-222222222222",
            "offer_code": "numerique",
            "amount_gnf": 40000,
            "status": "pending",
            "items": None,
            "payment_method": "manual",
            "devis_demande": False,
            "created_at": "2026-10-09T00:00:00Z",
        }

        with patch(
            "payments.services._load_owned_order",
            return_value=order,
        ):
            with patch(
                "payments.services._latest_payment",
                return_value=None,
            ):
                with patch(
                    "payments.services._latest_invoice",
                    return_value=None,
                ):
                    result = get_payment_order(
                        user_id=order["customer_id"],
                        order_ref=order["order_ref"],
                    )

        self.assertEqual(
            result["items"],
            [],
        )
