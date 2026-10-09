from __future__ import annotations

import json

from django.test import SimpleTestCase

from entitlements import (
    ADDRESS_NUMBER,
    ADDRESS_SHARING,
    API_ACCESS,
    EXTERNAL_NAVIGATION,
    GPS_LOCATION,
    PHYSICAL_PLATE,
    QR_CODE,
    capabilities_from_order_items,
    effective_address_capabilities,
    legacy_address_capabilities,
    normalize_capabilities,
    resolve_plan_capabilities,
)


class EntitlementContractTests(
    SimpleTestCase
):
    def test_numerique_fallback_is_digital_baseline(
        self,
    ):
        result = resolve_plan_capabilities(
            plan_code="numerique",
            configured=[],
            requires_quote=False,
        )

        self.assertEqual(
            result,
            [
                ADDRESS_NUMBER,
                QR_CODE,
                GPS_LOCATION,
                EXTERNAL_NAVIGATION,
                ADDRESS_SHARING,
            ],
        )

    def test_configured_standard_capabilities_are_used(
        self,
    ):
        result = resolve_plan_capabilities(
            plan_code="residentiel_standard",
            configured=[
                ADDRESS_NUMBER,
                PHYSICAL_PLATE,
            ],
            requires_quote=False,
        )

        self.assertEqual(
            result,
            [
                ADDRESS_NUMBER,
                PHYSICAL_PLATE,
            ],
        )

    def test_professional_quote_never_auto_grants(
        self,
    ):
        result = resolve_plan_capabilities(
            plan_code="pro",
            configured=[
                API_ACCESS,
            ],
            requires_quote=True,
        )

        self.assertEqual(
            result,
            [],
        )

    def test_unknown_capability_is_rejected(
        self,
    ):
        with self.assertRaises(
            ValueError
        ):
            normalize_capabilities(
                [
                    "unknown_capability",
                ]
            )

    def test_order_snapshot_is_decoded(
        self,
    ):
        items = json.dumps(
            [
                {
                    "capabilities": [
                        ADDRESS_NUMBER,
                        QR_CODE,
                    ]
                }
            ]
        )

        self.assertEqual(
            capabilities_from_order_items(
                items
            ),
            [
                ADDRESS_NUMBER,
                QR_CODE,
            ],
        )

    def test_active_legacy_address_gets_conservative_baseline(
        self,
    ):
        result = effective_address_capabilities(
            address_status="active",
            has_paid_order=False,
            order_items=None,
        )

        self.assertEqual(
            result,
            legacy_address_capabilities(),
        )

    def test_paid_snapshot_is_authoritative(
        self,
    ):
        items = [
            {
                "capabilities": [
                    ADDRESS_NUMBER,
                    PHYSICAL_PLATE,
                ]
            }
        ]

        result = effective_address_capabilities(
            address_status="active",
            has_paid_order=True,
            order_items=items,
        )

        self.assertEqual(
            result,
            [
                ADDRESS_NUMBER,
                PHYSICAL_PLATE,
            ],
        )

    def test_paid_order_without_snapshot_gets_legacy_baseline(
        self,
    ):
        result = effective_address_capabilities(
            address_status="active",
            has_paid_order=True,
            order_items=[
                {
                    "fulfillment_kind": (
                        "digital_address"
                    )
                }
            ],
        )

        self.assertEqual(
            result,
            legacy_address_capabilities(),
        )

    def test_inactive_address_has_no_effective_capability(
        self,
    ):
        result = effective_address_capabilities(
            address_status="suspended",
            has_paid_order=False,
            order_items=None,
        )

        self.assertEqual(
            result,
            [],
        )
