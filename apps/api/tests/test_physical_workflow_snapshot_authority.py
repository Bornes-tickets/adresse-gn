from __future__ import annotations

import inspect

from django.test import SimpleTestCase

import backoffice.physical_installation_workflow as workflow
from backoffice.physical_installation_workflow import (
    PhysicalWorkflowStateError,
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


def valid_physical_items():
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


class PhysicalWorkflowSnapshotAuthorityTests(
    SimpleTestCase
):
    def test_valid_v1_physical_snapshot_is_accepted(
        self,
    ):
        result = (
            _require_physical_purchase_snapshot(
                items=valid_physical_items(),
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
            PhysicalWorkflowStateError
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


    def test_workflow_no_longer_uses_current_catalogue_authority(
        self,
    ):
        source = inspect.getsource(
            workflow
        )

        self.assertNotIn(
            "JOIN public.cms_plans cp",
            source,
        )

        self.assertNotIn(
            "cp.fulfillment_kind",
            source,
        )


    def test_all_three_loaders_use_purchase_snapshot(
        self,
    ):
        for function in (
            workflow._load_pending_for_update,
            workflow._load_validation_targets,
            workflow._load_publication_target,
        ):
            source = inspect.getsource(
                function
            )

            self.assertIn(
                "o.items",
                source,
            )

            self.assertIn(
                "_require_physical_purchase_snapshot(",
                source,
            )


    def test_assignment_loader_derives_fulfillment_from_snapshot(
        self,
    ):
        source = inspect.getsource(
            workflow._load_pending_for_update
        )

        self.assertIn(
            'requirements["fulfillment_kind"]',
            "".join(
                source.split()
            ),
        )


    def test_gps_field_complete_is_not_part_of_this_patch(
        self,
    ):
        source = inspect.getsource(
            workflow
        )

        self.assertNotIn(
            "gps_measurements",
            source,
        )

        self.assertNotIn(
            "INSTALLATION_GPS_MEASURE_COUNT",
            source,
        )
