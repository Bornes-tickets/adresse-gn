from __future__ import annotations

import base64
from pathlib import Path
from uuid import uuid4

from django.test import SimpleTestCase
from rest_framework import status

from agent_portal.serializers import (
    ADDRESS_CATEGORY_CHOICES,
    AGENT_GPS_MAX_ACCURACY_M,
    AGENT_GPS_MEASURE_COUNT,
    AgentTaskCompleteSerializer,
    INSTALLATION_PHOTO_MAX_BYTES,
)


def jpeg_data_url(
    payload: bytes = b"agent-v1",
) -> str:
    raw = (
        b"\xff\xd8"
        + payload
        + b"\xff\xd9"
    )

    encoded = base64.b64encode(
        raw
    ).decode(
        "ascii"
    )

    return (
        "data:image/jpeg;base64,"
        + encoded
    )


def valid_payload() -> dict:
    return {
        "client_uuid": str(
            uuid4()
        ),
        "measures": [
            {
                "lat": 9.5955001,
                "lng": -13.6478001,
                "accuracy_m": 2.8,
                "taken_at": (
                    "2026-10-21T10:00:00Z"
                ),
            },
            {
                "lat": 9.5955002,
                "lng": -13.6478002,
                "accuracy_m": 3.0,
                "taken_at": (
                    "2026-10-21T10:00:02Z"
                ),
            },
            {
                "lat": 9.5955003,
                "lng": -13.6478003,
                "accuracy_m": 2.9,
                "taken_at": (
                    "2026-10-21T10:00:04Z"
                ),
            },
        ],
        "photo_base64": (
            jpeg_data_url()
        ),
        "category": "habitation",
        "name": None,
        "visibility": "private",
        "access_point_note": None,
        "owner_name": None,
        "owner_phone": None,
        "consent": True,
    }


class AgentCompleteSerializerTests(
    SimpleTestCase
):
    def test_contract_constants(
        self,
    ):
        self.assertEqual(
            AGENT_GPS_MEASURE_COUNT,
            3,
        )

        self.assertEqual(
            AGENT_GPS_MAX_ACCURACY_M,
            3.0,
        )

        self.assertEqual(
            INSTALLATION_PHOTO_MAX_BYTES,
            500 * 1024,
        )


    def test_valid_payload_accepts_exactly_three_and_3m(
        self,
    ):
        serializer = (
            AgentTaskCompleteSerializer(
                data=valid_payload()
            )
        )

        self.assertTrue(
            serializer.is_valid(),
            serializer.errors,
        )

        self.assertEqual(
            len(
                serializer.validated_data[
                    "measures"
                ]
            ),
            3,
        )


    def test_two_measures_are_rejected(
        self,
    ):
        payload = valid_payload()

        payload[
            "measures"
        ] = payload[
            "measures"
        ][:2]

        serializer = (
            AgentTaskCompleteSerializer(
                data=payload
            )
        )

        self.assertFalse(
            serializer.is_valid()
        )

        self.assertIn(
            "measures",
            serializer.errors,
        )


    def test_four_measures_are_rejected(
        self,
    ):
        payload = valid_payload()

        payload[
            "measures"
        ].append(
            dict(
                payload[
                    "measures"
                ][-1]
            )
        )

        serializer = (
            AgentTaskCompleteSerializer(
                data=payload
            )
        )

        self.assertFalse(
            serializer.is_valid()
        )

        self.assertIn(
            "measures",
            serializer.errors,
        )


    def test_accuracy_over_3m_is_rejected(
        self,
    ):
        payload = valid_payload()

        payload[
            "measures"
        ][1][
            "accuracy_m"
        ] = 3.0001

        serializer = (
            AgentTaskCompleteSerializer(
                data=payload
            )
        )

        self.assertFalse(
            serializer.is_valid()
        )


    def test_coordinate_ranges_are_enforced(
        self,
    ):
        payload = valid_payload()

        payload[
            "measures"
        ][0][
            "lat"
        ] = 90.0001

        serializer = (
            AgentTaskCompleteSerializer(
                data=payload
            )
        )

        self.assertFalse(
            serializer.is_valid()
        )


    def test_taken_at_is_required(
        self,
    ):
        payload = valid_payload()

        del payload[
            "measures"
        ][0][
            "taken_at"
        ]

        serializer = (
            AgentTaskCompleteSerializer(
                data=payload
            )
        )

        self.assertFalse(
            serializer.is_valid()
        )


    def test_client_uuid_is_required(
        self,
    ):
        payload = valid_payload()

        del payload[
            "client_uuid"
        ]

        serializer = (
            AgentTaskCompleteSerializer(
                data=payload
            )
        )

        self.assertFalse(
            serializer.is_valid()
        )


    def test_client_agent_id_is_forbidden(
        self,
    ):
        payload = valid_payload()

        payload[
            "agent_id"
        ] = str(
            uuid4()
        )

        serializer = (
            AgentTaskCompleteSerializer(
                data=payload
            )
        )

        self.assertFalse(
            serializer.is_valid()
        )

        self.assertIn(
            "agent_id",
            serializer.errors,
        )


    def test_sequence_no_is_server_owned(
        self,
    ):
        payload = valid_payload()

        payload[
            "measures"
        ][0][
            "sequence_no"
        ] = 1

        serializer = (
            AgentTaskCompleteSerializer(
                data=payload
            )
        )

        self.assertFalse(
            serializer.is_valid()
        )


    def test_beacon_number_is_server_owned(
        self,
    ):
        payload = valid_payload()

        payload[
            "beacon_number"
        ] = "GN-CKY-999999"

        serializer = (
            AgentTaskCompleteSerializer(
                data=payload
            )
        )

        self.assertFalse(
            serializer.is_valid()
        )


    def test_consent_must_be_true(
        self,
    ):
        payload = valid_payload()

        payload[
            "consent"
        ] = False

        serializer = (
            AgentTaskCompleteSerializer(
                data=payload
            )
        )

        self.assertFalse(
            serializer.is_valid()
        )


    def test_agent_cannot_request_public_visibility(
        self,
    ):
        payload = valid_payload()

        payload[
            "visibility"
        ] = "public"

        serializer = (
            AgentTaskCompleteSerializer(
                data=payload
            )
        )

        self.assertFalse(
            serializer.is_valid()
        )


    def test_category_uses_database_vocabulary(
        self,
    ):
        expected = {
            "habitation",
            "restaurant",
            "hotel",
            "bar",
            "commerce",
            "entreprise",
            "administration",
            "ecole",
            "sante",
            "pharmacie",
            "banque",
            "tourisme",
            "other",
        }

        self.assertEqual(
            set(
                ADDRESS_CATEGORY_CHOICES
            ),
            expected,
        )

        payload = valid_payload()

        payload[
            "category"
        ] = "bureau"

        serializer = (
            AgentTaskCompleteSerializer(
                data=payload
            )
        )

        self.assertFalse(
            serializer.is_valid()
        )


    def test_photo_must_be_jpeg_data_url(
        self,
    ):
        payload = valid_payload()

        payload[
            "photo_base64"
        ] = (
            "data:image/png;base64,"
            + base64.b64encode(
                b"not-jpeg"
            ).decode(
                "ascii"
            )
        )

        serializer = (
            AgentTaskCompleteSerializer(
                data=payload
            )
        )

        self.assertFalse(
            serializer.is_valid()
        )


    def test_photo_over_500_kib_is_rejected(
        self,
    ):
        payload = valid_payload()

        raw = (
            b"\xff\xd8"
            + (
                b"x"
                * INSTALLATION_PHOTO_MAX_BYTES
            )
            + b"\xff\xd9"
        )

        payload[
            "photo_base64"
        ] = (
            "data:image/jpeg;base64,"
            + base64.b64encode(
                raw
            ).decode(
                "ascii"
            )
        )

        serializer = (
            AgentTaskCompleteSerializer(
                data=payload
            )
        )

        self.assertFalse(
            serializer.is_valid()
        )


class AgentCompleteHttpContractTests(
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


    def test_route_is_exact_and_uuid_scoped(
        self,
    ):
        from django.urls import resolve

        pending_id = uuid4()

        match = resolve(
            (
                "/api/v1/agent/tasks/"
                f"{pending_id}/complete/"
            )
        )

        self.assertEqual(
            match.url_name,
            "agent-task-complete",
        )

        self.assertEqual(
            match.kwargs[
                "pending_installation_id"
            ],
            pending_id,
        )

        self.assertEqual(
            match.func.view_class.__name__,
            "AgentTaskCompleteView",
        )



    def test_view_uses_authenticated_agent_permission(
        self,
    ):
        import ast
        import inspect
        import textwrap

        from rest_framework.permissions import (
            IsAuthenticated,
        )

        from agent_portal.permissions import (
            IsActiveFieldAgent,
        )

        from agent_portal.views import (
            AgentTaskCompleteView,
        )

        self.assertEqual(
            AgentTaskCompleteView.permission_classes,
            [
                IsAuthenticated,
                IsActiveFieldAgent,
            ],
        )

        source = textwrap.dedent(
            inspect.getsource(
                AgentTaskCompleteView.post
            )
        )

        tree = ast.parse(
            source
        )

        agent_identity_getattr = False

        for node in ast.walk(
            tree
        ):
            if not isinstance(
                node,
                ast.Call,
            ):
                continue

            if not (
                isinstance(
                    node.func,
                    ast.Name,
                )
                and node.func.id == "getattr"
            ):
                continue

            if len(
                node.args
            ) < 2:
                continue

            request_arg = node.args[0]
            identity_arg = node.args[1]

            if not (
                isinstance(
                    request_arg,
                    ast.Name,
                )
                and request_arg.id
                == "request"
            ):
                continue

            if not (
                isinstance(
                    identity_arg,
                    ast.Constant,
                )
                and identity_arg.value
                == "agent_identity"
            ):
                continue

            agent_identity_getattr = True
            break

        self.assertTrue(
            agent_identity_getattr,
            (
                "AgentTaskCompleteView.post must "
                "consume request.agent_identity."
            ),
        )



    def test_b2_endpoint_is_wired_to_agent_service(
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
            "AGENT_COMPLETE_SERVICE_NOT_IMPLEMENTED",
            views,
        )



    def test_agent_service_remains_unmodified_write_free_boundary(
        self,
    ):
        services = (
            self.root
            / "agent_portal"
            / "services.py"
        ).read_text(
            encoding="utf-8"
        )

        upper = services.upper()

        self.assertNotIn(
            "INSERT INTO ",
            upper,
        )

        self.assertNotIn(
            "UPDATE PUBLIC.",
            upper,
        )

        self.assertNotIn(
            "DELETE FROM ",
            upper,
        )


    def test_new_agent_contract_does_not_reuse_legacy_complete(
        self,
    ):
        combined = (
            (
                self.root
                / "agent_portal"
                / "views.py"
            ).read_text(
                encoding="utf-8"
            )
            + "\n"
            + (
                self.root
                / "agent_portal"
                / "serializers.py"
            ).read_text(
                encoding="utf-8"
            )
        )

        self.assertNotIn(
            "record_physical_installation",
            combined,
        )

        self.assertNotIn(
            "field-complete",
            combined,
        )


    def test_server_owned_fields_not_defined_in_serializer(
        self,
    ):
        serializer_source = (
            self.root
            / "agent_portal"
            / "serializers.py"
        ).read_text(
            encoding="utf-8"
        )

        for forbidden_definition in (
            "agent_id = serializers.",
            "beacon_id = serializers.",
            "order_id = serializers.",
            "pending_installation_id = serializers.",
            "sequence_no = serializers.",
        ):
            with self.subTest(
                token=forbidden_definition
            ):
                self.assertNotIn(
                    forbidden_definition,
                    serializer_source,
                )


    def test_http_success_status_constant_is_available(
        self,
    ):
        self.assertEqual(
            status.HTTP_200_OK,
            200,
        )
