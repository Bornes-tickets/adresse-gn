from __future__ import annotations

import inspect
from unittest import TestCase

from payments.services import (
    SalesPaymentFulfillmentError,
    _payment_order_contract_from_items,
    _require_physical_installation_v1,
    confirm_manual_payment_core,
)


STANDARD_CAPABILITIES = [
    "address_number",
    "qr_code",
    "gps_location",
    "external_navigation",
    "address_sharing",
    "physical_plate",
    "installation_tracking",
]


def digital_pre_snapshot_items():
    return [
        {
            "qty": 1,
            "ref": "numerique",
            "code": "numerique",
            "label": "Num?rique seule",
            "unit_price_gnf": 40000,
            "fulfillment_kind": "digital_address",
        }
    ]


def physical_items(
    *,
    include_version=True,
    include_capabilities=True,
):
    item = {
        "qty": 1,
        "ref": "residentiel_standard",
        "code": "residentiel_standard",
        "label": "R?sidentiel Standard",
        "unit_price_gnf": 150000,
        "fulfillment_kind": "physical_installation",
    }

    if include_capabilities:
        item["capabilities"] = list(
            STANDARD_CAPABILITIES
        )

    if include_version:
        item[
            "installation_requirements_version"
        ] = 1

    return [
        item
    ]


class PaymentSnapshotAuthorityTests(
    TestCase
):
    def test_digital_pre_snapshot_fulfillment_is_item_derived(
        self,
    ):
        contract = (
            _payment_order_contract_from_items(
                items=digital_pre_snapshot_items(),
            )
        )

        self.assertEqual(
            contract["fulfillment_kind"],
            "digital_address",
        )

        self.assertEqual(
            contract["plan_code"],
            "numerique",
        )


    def test_physical_plan_code_is_item_derived(
        self,
    ):
        contract = (
            _payment_order_contract_from_items(
                items=physical_items(),
            )
        )

        self.assertEqual(
            contract["fulfillment_kind"],
            "physical_installation",
        )

        self.assertEqual(
            contract["plan_code"],
            "residentiel_standard",
        )


    def test_pre_v1_physical_snapshot_fails_closed(
        self,
    ):
        with self.assertRaises(
            SalesPaymentFulfillmentError
        ):
            _require_physical_installation_v1(
                items=physical_items(
                    include_version=False,
                    include_capabilities=False,
                ),
            )


    def test_valid_v1_physical_snapshot_passes(
        self,
    ):
        requirements = (
            _require_physical_installation_v1(
                items=physical_items(),
            )
        )

        self.assertEqual(
            requirements["version"],
            1,
        )

        self.assertEqual(
            requirements[
                "fulfillment_kind"
            ],
            "physical_installation",
        )

        self.assertEqual(
            requirements[
                "gps_measure_count"
            ],
            3,
        )

        self.assertEqual(
            requirements[
                "gps_max_accuracy_m"
            ],
            3.0,
        )


    def test_confirmation_has_no_current_catalogue_authority(
        self,
    ):
        source = inspect.getsource(
            confirm_manual_payment_core
        )

        self.assertNotIn(
            "LEFT JOIN public.cms_plans cp",
            source,
        )

        self.assertNotIn(
            "cp.code AS plan_code",
            source,
        )

        self.assertNotIn(
            "to_jsonb(cp) ->> 'fulfillment_kind'",
            source,
        )

        self.assertNotIn(
            'row["fulfillment_kind"]',
            source,
        )

        self.assertNotIn(
            'row["plan_code"]',
            source,
        )

        self.assertIn(
            "_payment_order_contract_from_items(",
            source,
        )

        self.assertIn(
            "plan_code=plan_code",
            source,
        )


    def test_physical_v1_gate_precedes_site_lock(
        self,
    ):
        source = inspect.getsource(
            confirm_manual_payment_core
        )

        gate = source.index(
            "_require_physical_installation_v1("
        )

        site_lock = source.index(
            "_lock_single_order_site("
        )

        self.assertLess(
            gate,
            site_lock,
        )


    def test_empty_items_fail_closed_before_fulfillment(
        self,
    ):
        with self.assertRaises(
            SalesPaymentFulfillmentError
        ):
            _payment_order_contract_from_items(
                items=[],
            )
