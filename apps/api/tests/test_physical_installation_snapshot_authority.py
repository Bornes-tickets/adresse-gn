from __future__ import annotations

import inspect

from django.test import SimpleTestCase

import backoffice.physical_installations as service

from backoffice.physical_installations import (
    PhysicalInstallationStateError,
    _require_physical_purchase_snapshot,
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


def valid_v1_items():
    return [
        {
            "qty": 1,
            "code": "residentiel_standard",
            "ref": "residentiel_standard",
            "fulfillment_kind": "physical_installation",
            "capabilities": list(
                STANDARD_CAPABILITIES
            ),
            "installation_requirements_version": 1,
        }
    ]


class PhysicalInstallationSnapshotAuthorityTests(
    SimpleTestCase
):
    def test_valid_v1_physical_snapshot_is_accepted(
        self,
    ):
        result = (
            _require_physical_purchase_snapshot(
                items=valid_v1_items(),
            )
        )

        self.assertEqual(
            result["version"],
            1,
        )

        self.assertEqual(
            result["fulfillment_kind"],
            "physical_installation",
        )


    def test_pre_v1_physical_snapshot_fails_closed(
        self,
    ):
        with self.assertRaises(
            PhysicalInstallationStateError
        ):
            _require_physical_purchase_snapshot(
                items=[
                    {
                        "qty": 1,
                        "code": "residentiel_standard",
                        "ref": "residentiel_standard",
                        "fulfillment_kind": "physical_installation",
                    }
                ],
            )


    def test_record_uses_purchase_snapshot_not_current_catalogue(
        self,
    ):
        source = inspect.getsource(
            service.record_physical_installation
        )

        self.assertIn(
            "o.items",
            source,
        )

        self.assertIn(
            "_require_physical_purchase_snapshot(",
            source,
        )

        self.assertNotIn(
            "JOIN public.cms_plans cp",
            source,
        )

        self.assertNotIn(
            "cp.code AS plan_code",
            source,
        )

        self.assertNotIn(
            "cp.fulfillment_kind",
            source,
        )


    def test_installed_replay_precedes_snapshot_gate(
        self,
    ):
        source = inspect.getsource(
            service.record_physical_installation
        )

        replay = source.index(
            'if str(pending_status) == "installed":'
        )

        gate = source.index(
            "_require_physical_purchase_snapshot("
        )

        self.assertLess(
            replay,
            gate,
        )


    def test_legacy_single_gps_contract_is_unchanged(
        self,
    ):
        signature = inspect.signature(
            service.record_physical_installation
        )

        self.assertIn(
            "gps_lat",
            signature.parameters,
        )

        self.assertIn(
            "gps_lng",
            signature.parameters,
        )

        self.assertIn(
            "accuracy_m",
            signature.parameters,
        )

        self.assertNotIn(
            "gps_measurements",
            signature.parameters,
        )

        source = inspect.getsource(
            service.record_physical_installation
        )

        self.assertNotIn(
            "INSTALLATION_GPS_MEASURE_COUNT",
            source,
        )

        self.assertNotIn(
            "INSTALLATION_GPS_MAX_ACCURACY_M",
            source,
        )
