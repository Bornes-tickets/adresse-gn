from __future__ import annotations

import base64
import inspect

from datetime import (
    datetime,
    timezone,
)
from decimal import Decimal
from pathlib import Path

from django.test import SimpleTestCase

from agent_installations.services import (
    ADDRESS_CATEGORY_CHOICES,
    AgentCompletionContractError,
    INSTALLATION_PHOTO_MAX_BYTES,
    _aggregate_measures,
    _decode_photo,
    _validate_business_payload,
    _validated_measures,
)


def measure(
    *,
    lat: str,
    lng: str,
    accuracy: str,
    second: int,
) -> dict:
    return {
        "lat":
            lat,

        "lng":
            lng,

        "accuracy_m":
            accuracy,

        "taken_at":
            datetime(
                2026,
                10,
                21,
                10,
                0,
                second,
                tzinfo=timezone.utc,
            ),
    }


class AgentCompletionPureContractTests(
    SimpleTestCase
):
    def test_exactly_three_and_3m_are_accepted(
        self,
    ):
        values = _validated_measures(
            [
                measure(
                    lat="9.1",
                    lng="-13.1",
                    accuracy="2.8",
                    second=0,
                ),
                measure(
                    lat="9.2",
                    lng="-13.2",
                    accuracy="3.0",
                    second=2,
                ),
                measure(
                    lat="9.3",
                    lng="-13.3",
                    accuracy="2.9",
                    second=4,
                ),
            ]
        )

        self.assertEqual(
            [
                item[
                    "sequence_no"
                ]
                for item in values
            ],
            [
                1,
                2,
                3,
            ],
        )


    def test_accuracy_over_3m_fails_closed(
        self,
    ):
        with self.assertRaises(
            AgentCompletionContractError
        ):
            _validated_measures(
                [
                    measure(
                        lat="9.1",
                        lng="-13.1",
                        accuracy="2.8",
                        second=0,
                    ),
                    measure(
                        lat="9.2",
                        lng="-13.2",
                        accuracy="3.0001",
                        second=2,
                    ),
                    measure(
                        lat="9.3",
                        lng="-13.3",
                        accuracy="2.9",
                        second=4,
                    ),
                ]
            )


    def test_server_aggregate_rounding_is_frozen(
        self,
    ):
        values = _validated_measures(
            [
                measure(
                    lat="1.00000004",
                    lng="-1.00000004",
                    accuracy="2.99",
                    second=0,
                ),
                measure(
                    lat="1.00000005",
                    lng="-1.00000005",
                    accuracy="3.00",
                    second=2,
                ),
                measure(
                    lat="1.00000006",
                    lng="-1.00000006",
                    accuracy="3.00",
                    second=4,
                ),
            ]
        )

        (
            lat,
            lng,
            accuracy,
        ) = _aggregate_measures(
            values
        )

        self.assertEqual(
            lat,
            Decimal(
                "1.0000001"
            ),
        )

        self.assertEqual(
            lng,
            Decimal(
                "-1.0000001"
            ),
        )

        self.assertEqual(
            accuracy,
            Decimal(
                "3.00"
            ),
        )


    def test_jpeg_contract_and_limit(
        self,
    ):
        raw = (
            b"\xff\xd8"
            + b"agent-v1"
            + b"\xff\xd9"
        )

        data_url = (
            "data:image/jpeg;base64,"
            + base64.b64encode(
                raw
            ).decode(
                "ascii"
            )
        )

        self.assertEqual(
            _decode_photo(
                data_url
            ),
            raw,
        )

        too_large = (
            b"\xff\xd8"
            + (
                b"x"
                * INSTALLATION_PHOTO_MAX_BYTES
            )
            + b"\xff\xd9"
        )

        too_large_url = (
            "data:image/jpeg;base64,"
            + base64.b64encode(
                too_large
            ).decode(
                "ascii"
            )
        )

        with self.assertRaises(
            AgentCompletionContractError
        ):
            _decode_photo(
                too_large_url
            )


    def test_business_snapshot_semantics(
        self,
    ):
        standard = {
            "consent_required":
                True,

            "commercial_place_name_required":
                True,

            "access_point_note_required":
                False,
        }

        premium = {
            "consent_required":
                True,

            "commercial_place_name_required":
                True,

            "access_point_note_required":
                True,
        }

        base = {
            "category":
                "habitation",

            "visibility":
                "private",

            "consent":
                True,

            "name":
                "Maison Barry",

            "access_point_note":
                None,

            "owner_name":
                None,

            "owner_phone":
                None,
        }

        self.assertEqual(
            _validate_business_payload(
                payload=base,
                requirements=standard,
            )[
                "name"
            ],
            "Maison Barry",
        )

        with self.assertRaises(
            AgentCompletionContractError
        ):
            _validate_business_payload(
                payload=base,
                requirements=premium,
            )


    def test_category_contract_matches_http_serializer(
        self,
    ):
        from agent_portal.serializers import (
            ADDRESS_CATEGORY_CHOICES as HTTP_CHOICES,
        )

        self.assertEqual(
            set(
                ADDRESS_CATEGORY_CHOICES
            ),
            set(
                HTTP_CHOICES
            ),
        )


class AgentCompletionSourceContractTests(
    SimpleTestCase
):
    def setUp(
        self,
    ):
        self.root = (
            Path(__file__)
            .resolve()
            .parents[1]
        )

        self.service_path = (
            self.root
            / "agent_installations"
            / "services.py"
        )

        self.source = (
            self.service_path
            .read_text(
                encoding="utf-8"
            )
        )


    def test_b2_service_is_exposed_only_through_agent_view(
        self,
    ):
        views = (
            self.root
            / "agent_portal"
            / "views.py"
        ).read_text(
            encoding="utf-8"
        )

        self.assertIn(
            "complete_agent_installation",
            views,
        )

        self.assertNotIn(
            "record_physical_installation",
            views,
        )

        self.assertNotIn(
            "field-complete",
            views,
        )



    def test_service_uses_purchase_snapshot_not_catalogue(
        self,
    ):
        self.assertIn(
            "o.items",
            self.source,
        )

        self.assertIn(
            (
                "installation_requirements_"
                "from_order_items"
            ),
            self.source,
        )

        self.assertNotIn(
            "cms_plans",
            self.source.lower(),
        )


    def test_transactional_write_contract(
        self,
    ):
        required = [
            "with transaction.atomic()",
            "FOR UPDATE OF pi, o",
            "pg_advisory_xact_lock",
            "INSERT INTO public.installations",
            (
                "INSERT INTO "
                "public.installation_measures"
            ),
            "sequence_no",
            "UPDATE public.addresses",
            "UPDATE public.order_sites",
            "UPDATE public.orders",
            (
                "UPDATE public."
                "pending_installations"
            ),
            "status = 'installed'",
            "completed_at IS NULL",
            "installation.agent_complete.v1",
        ]

        for token in required:
            with self.subTest(
                token=token
            ):
                self.assertIn(
                    token,
                    self.source,
                )

        self.assertNotIn(
            "completed_at = NOW()",
            self.source,
        )


    def test_idempotence_precedes_photo_upload(
        self,
    ):
        module = __import__(
            "agent_installations.services",
            fromlist=[
                "complete_agent_installation",
            ],
        )

        function_source = (
            inspect.getsource(
                module
                .complete_agent_installation
            )
        )

        replay_index = (
            function_source.index(
                "WHERE client_uuid = %s"
            )
        )

        upload_index = (
            function_source.index(
                "_upload_installation_photo("
            )
        )

        self.assertLess(
            replay_index,
            upload_index,
        )


    def test_storage_path_is_stable_by_agent_and_client_uuid(
        self,
    ):
        self.assertIn(
            (
                'f"{agent_id}/"'
            ),
            self.source,
        )

        self.assertIn(
            (
                'f"{client_uuid}.jpg"'
            ),
            self.source,
        )

        self.assertIn(
            '"x-upsert": "true"',
            self.source,
        )


    def test_no_legacy_complete_or_routing_reuse(
        self,
    ):
        forbidden = [
            "record_physical_installation",
            "field-complete",
            "pgrouting",
            "snap_point",
            "snap_radius",
        ]

        lower = (
            self.source.lower()
        )

        for token in forbidden:
            with self.subTest(
                token=token
            ):
                self.assertNotIn(
                    token.lower(),
                    lower,
                )


    def test_agent_portal_read_service_remains_write_free(
        self,
    ):
        source = (
            self.root
            / "agent_portal"
            / "services.py"
        ).read_text(
            encoding="utf-8"
        ).upper()

        for token in (
            "INSERT INTO ",
            "UPDATE PUBLIC.",
            "DELETE FROM ",
        ):
            with self.subTest(
                token=token
            ):
                self.assertNotIn(
                    token,
                    source,
                )


    def test_service_contains_no_live_fixture_identifier(
        self,
    ):
        for forbidden in (
            "ORD-20260825-0005",
            "GN-CKY-",
            "AG001",
        ):
            with self.subTest(
                token=forbidden
            ):
                self.assertNotIn(
                    forbidden,
                    self.source,
                )


    def test_package_is_plain_python_module(
        self,
    ):
        init_path = (
            self.root
            / "agent_installations"
            / "__init__.py"
        )

        self.assertTrue(
            init_path.exists()
        )

        self.assertEqual(
            init_path.read_text(
                encoding="utf-8"
            ),
            "",
        )
