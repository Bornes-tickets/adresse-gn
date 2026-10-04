from unittest import TestCase

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
    def test_service_contains_canonical_writes(self):
        from pathlib import Path
        import backoffice.physical_installations as module

        source = Path(module.__file__).read_text(encoding="utf-8")

        required = [
            "INSERT INTO public.beacons",
            "INSERT INTO public.addresses",
            "INSERT INTO public.installations",
            "UPDATE public.order_sites",
            "UPDATE public.orders",
            "UPDATE public.pending_installations",
            "sector_id",
            "owner_id",
            "residentiel_standard",
            "residentiel_premium",
            "residential",
            "residential_plus",
            "FOR UPDATE",
        ]

        missing = [token for token in required if token not in source]
        self.assertEqual(missing, [])
