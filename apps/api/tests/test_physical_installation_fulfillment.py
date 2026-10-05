from pathlib import Path
from unittest import TestCase

import backoffice.physical_installations as module

from backoffice.physical_installations import (
    PhysicalInstallationStateError,
    _validate_coordinates,
)
from backoffice.serializers import (
    PhysicalInstallationCompleteSerializer,
)


class PhysicalInstallationSerializerTests(TestCase):
    def test_valid_payload(self):
        serializer = PhysicalInstallationCompleteSerializer(
            data={
                "agent_id": "44444444-4444-4444-4444-444444444444",
                "gps_lat": 9.6412,
                "gps_lng": -13.5784,
                "accuracy_m": 4.5,
                "photo_url": "https://example.test/install.jpg",
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_invalid_latitude_is_rejected(self):
        serializer = PhysicalInstallationCompleteSerializer(
            data={
                "agent_id": "44444444-4444-4444-4444-444444444444",
                "gps_lat": 91,
                "gps_lng": -13.5,
            }
        )
        self.assertFalse(serializer.is_valid())


class PhysicalInstallationCoordinateTests(TestCase):
    def test_coordinate_contract(self):
        lat, lng = _validate_coordinates(
            gps_lat=9.64,
            gps_lng=-13.58,
        )
        self.assertEqual(lat, 9.64)
        self.assertEqual(lng, -13.58)

    def test_invalid_longitude_raises(self):
        with self.assertRaises(PhysicalInstallationStateError):
            _validate_coordinates(
                gps_lat=9.64,
                gps_lng=181,
            )


class PhysicalInstallationSourceContractTests(TestCase):
    def test_service_reuses_preallocated_canonical_identity(self):
        """
        R13 contract.

        Field-complete must reuse the physical identity that was
        preallocated during payment fulfillment.

        It must therefore NOT:
        - allocate another V1 number,
        - create another beacon,
        - create another canonical address.
        """
        source = Path(module.__file__).read_text(encoding="utf-8")

        forbidden = [
            "_next_v1_beacon_number",
            "INSERT INTO public.beacons",
            "INSERT INTO public.addresses",
        ]

        unexpected = [
            token
            for token in forbidden
            if token in source
        ]

        self.assertEqual(
            unexpected,
            [],
            (
                "R13 violation: field-complete must reuse the "
                "preallocated beacon/address and must not allocate "
                "or create a second canonical identity. "
                f"Unexpected tokens: {unexpected}"
            ),
        )

    def test_service_contains_field_complete_writes(self):
        """
        R13 field-complete responsibilities that remain valid.

        The terrain workflow must:
        - create the physical installation record,
        - update the order/site linkage workflow,
        - update the pending installation,
        - transition the pending installation to installed,
        - preserve locking/audit guarantees.
        """
        source = Path(module.__file__).read_text(encoding="utf-8")

        required = [
            "INSERT INTO public.installations",
            "UPDATE public.order_sites",
            "UPDATE public.orders",
            "UPDATE public.pending_installations",
            "owner_id",
            "status = 'installed'",
            "'pending'",
            "installation.field_complete.v1",
            "FOR UPDATE",
        ]

        missing = [
            token
            for token in required
            if token not in source
        ]

        self.assertEqual(
            missing,
            [],
            (
                "R13 violation: required field-complete workflow "
                f"tokens are missing: {missing}"
            ),
        )