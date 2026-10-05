import inspect
from unittest import TestCase

from backoffice.physical_installations import record_physical_installation
from payments.services import (
    _fulfill_digital_address,
    _fulfill_physical_installation,
    _load_confirmation_result,
    confirm_manual_payment_core,
)


class R13PhysicalPreallocationSourceTests(TestCase):
    def test_physical_payment_fulfillment_preallocates_canonical_address(self):
        source = inspect.getsource(_fulfill_physical_installation)

        required = [
            "_next_v1_beacon_number(",
            "INSERT INTO public.beacons",
            "INSERT INTO public.addresses",
            "sector_id",
            "UPDATE public.orders",
            "UPDATE public.order_sites",
            "INSERT INTO public.pending_installations",
            "beacon_id",
            "'private'",
            "'pending'",
        ]

        for token in required:
            self.assertIn(token, source)

        self.assertIn("site: dict[str, Any]", source)
        self.assertIn("commune_code: str", source)
        self.assertIn("plan_code: str", source)

    def test_confirmation_passes_site_commune_and_plan_to_physical_fulfillment(self):
        source = inspect.getsource(confirm_manual_payment_core)
        call_start = source.index("_fulfill_physical_installation(")
        call_source = source[call_start:]

        self.assertIn("site=site", call_source)
        self.assertIn("commune_code=", call_source)
        self.assertIn('plan_code=str(row["plan_code"])', call_source)

    def test_replayed_physical_confirmation_returns_preallocated_identifiers(self):
        source = inspect.getsource(_load_confirmation_result)

        self.assertIn("physical_installation", source)
        self.assertIn("b.public_number", source)
        self.assertIn("a.id", source)
        self.assertIn('"beacon_id"', source)
        self.assertIn('"public_number"', source)
        self.assertIn('"address_id"', source)

    def test_field_complete_reuses_preallocation_and_no_longer_allocates_number(self):
        source = inspect.getsource(record_physical_installation)

        self.assertNotIn("_next_v1_beacon_number(", source)
        self.assertNotIn("INSERT INTO public.beacons", source)
        self.assertNotIn("INSERT INTO public.addresses", source)

        required = [
            "pending_beacon_id is None",
            "order_beacon_id is None",
            "site_beacon_id is None",
            "UPDATE public.addresses",
            "ST_MakePoint(",
            "INSERT INTO public.installations",
            "status = 'installed'",
        ]

        for token in required:
            self.assertIn(token, source)

    def test_digital_fulfillment_propagates_sector(self):
        source = inspect.getsource(_fulfill_digital_address)

        self.assertIn("sector_id", source)
        self.assertIn("s.sector_id", source)
