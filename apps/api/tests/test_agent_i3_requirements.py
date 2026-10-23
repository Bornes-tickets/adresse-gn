from pathlib import Path
from unittest import TestCase

from entitlements import (
    INSTALLATION_GPS_MAX_ACCURACY_M,
    INSTALLATION_GPS_MEASURE_COUNT,
    INSTALLATION_REQUIREMENTS_VERSION,
    installation_requirements_from_order_items,
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


PREMIUM_CAPABILITIES = [
    *STANDARD_CAPABILITIES,
    "enhanced_plate",
    "priority_installation_72h",
    "detailed_access_note",
    "replacement_assistance_12m",
]


def physical_item(
    *,
    capabilities,
    version=INSTALLATION_REQUIREMENTS_VERSION,
):
    return [
        {
            "qty": 1,
            "code": "fixture",
            "fulfillment_kind": (
                "physical_installation"
            ),
            "capabilities": capabilities,
            "installation_requirements_version": (
                version
            ),
        }
    ]


class InstallationRequirementResolverTests(
    TestCase
):
    def test_standard_contract_v1(
        self,
    ):
        requirements = (
            installation_requirements_from_order_items(
                physical_item(
                    capabilities=STANDARD_CAPABILITIES,
                )
            )
        )

        self.assertIsNotNone(
            requirements
        )

        self.assertEqual(
            requirements["version"],
            1,
        )

        self.assertEqual(
            requirements["gps_measure_count"],
            3,
        )

        self.assertEqual(
            requirements["gps_max_accuracy_m"],
            3.0,
        )

        self.assertTrue(
            requirements["photo_required"]
        )

        self.assertTrue(
            requirements["consent_required"]
        )

        self.assertTrue(
            requirements["category_required"]
        )

        self.assertTrue(
            requirements["visibility_required"]
        )

        self.assertFalse(
            requirements[
                "access_point_note_required"
            ]
        )


    def test_premium_requires_detailed_access_note(
        self,
    ):
        requirements = (
            installation_requirements_from_order_items(
                physical_item(
                    capabilities=PREMIUM_CAPABILITIES,
                )
            )
        )

        self.assertIsNotNone(
            requirements
        )

        self.assertTrue(
            requirements[
                "access_point_note_required"
            ]
        )


    def test_missing_version_fails_closed(
        self,
    ):
        items = physical_item(
            capabilities=STANDARD_CAPABILITIES,
        )

        items[0].pop(
            "installation_requirements_version"
        )

        self.assertIsNone(
            installation_requirements_from_order_items(
                items
            )
        )


    def test_unknown_version_fails_closed(
        self,
    ):
        self.assertIsNone(
            installation_requirements_from_order_items(
                physical_item(
                    capabilities=STANDARD_CAPABILITIES,
                    version=999,
                )
            )
        )


    def test_non_physical_item_is_not_installable(
        self,
    ):
        items = [
            {
                "qty": 1,
                "code": "numerique",
                "fulfillment_kind": (
                    "digital_address"
                ),
                "capabilities": [
                    "address_number",
                    "qr_code",
                    "gps_location",
                ],
            }
        ]

        self.assertIsNone(
            installation_requirements_from_order_items(
                items
            )
        )


    def test_multiple_items_fail_closed(
        self,
    ):
        item = physical_item(
            capabilities=STANDARD_CAPABILITIES,
        )[0]

        self.assertIsNone(
            installation_requirements_from_order_items(
                [
                    item,
                    dict(item),
                ]
            )
        )


class CheckoutInstallationSnapshotSourceTests(
    TestCase
):
    def test_checkout_snapshots_requirement_version(
        self,
    ):
        root = (
            Path(__file__)
            .resolve()
            .parents[1]
        )

        source = (
            root
            / "checkout"
            / "services.py"
        ).read_text(
            encoding="utf-8"
        )

        self.assertIn(
            "'installation_requirements_version'",
            source,
        )

        self.assertIn(
            "INSTALLATION_REQUIREMENTS_VERSION",
            source,
        )

        self.assertIn(
            "WHEN %s = 'physical_installation'",
            source,
        )


    def test_v1_constants_are_frozen(
        self,
    ):
        self.assertEqual(
            INSTALLATION_REQUIREMENTS_VERSION,
            1,
        )

        self.assertEqual(
            INSTALLATION_GPS_MEASURE_COUNT,
            3,
        )

        self.assertEqual(
            INSTALLATION_GPS_MAX_ACCURACY_M,
            3.0,
        )
