from __future__ import annotations

import base64

from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from django.test import SimpleTestCase

from agent_installations.services import (
    AgentCompletionConflictError,
    AgentCompletionContractError,
    AgentCompletionNotFoundError,
    AgentCompletionStateError,
    AgentCompletionStorageError,
)
from agent_portal.views import (
    AgentTaskCompleteView,
)


def _photo() -> str:
    raw = (
        b"\xff\xd8"
        + b"agent-b2"
        + b"\xff\xd9"
    )

    return (
        "data:image/jpeg;base64,"
        + base64.b64encode(
            raw
        ).decode(
            "ascii"
        )
    )


def _payload() -> dict:
    return {
        "client_uuid": str(
            uuid4()
        ),

        "measures": [
            {
                "lat": 9.1,
                "lng": -13.1,
                "accuracy_m": 2.8,
                "taken_at":
                    "2026-10-21T10:00:00Z",
            },
            {
                "lat": 9.2,
                "lng": -13.2,
                "accuracy_m": 3.0,
                "taken_at":
                    "2026-10-21T10:00:02Z",
            },
            {
                "lat": 9.3,
                "lng": -13.3,
                "accuracy_m": 2.9,
                "taken_at":
                    "2026-10-21T10:00:04Z",
            },
        ],

        "photo_base64":
            _photo(),

        "category":
            "habitation",

        "name":
            "Maison Agent B2",

        "visibility":
            "private",

        "access_point_note":
            None,

        "owner_name":
            None,

        "owner_phone":
            None,

        "consent":
            True,
    }


def _request(
    *,
    agent_id: str | None,
):
    identity = (
        {
            "user_id":
                agent_id,
        }
        if agent_id
        else None
    )

    return SimpleNamespace(
        data=_payload(),
        agent_identity=identity,
    )


class AgentCompleteHttpWiringTests(
    SimpleTestCase
):
    def setUp(
        self,
    ):
        self.view = (
            AgentTaskCompleteView()
        )

        self.pending_id = (
            uuid4()
        )

        self.agent_id = str(
            uuid4()
        )


    @patch(
        "agent_portal.views."
        "complete_agent_installation"
    )
    def test_success_uses_server_agent_identity(
        self,
        service,
    ):
        service.return_value = {
            "ok": True,
            "status": "installed",
            "idempotent": False,
        }

        response = self.view.post(
            _request(
                agent_id=self.agent_id
            ),
            self.pending_id,
        )

        self.assertEqual(
            response.status_code,
            200,
        )

        service.assert_called_once()

        kwargs = (
            service.call_args.kwargs
        )

        self.assertEqual(
            kwargs[
                "agent_id"
            ],
            self.agent_id,
        )

        self.assertEqual(
            kwargs[
                "pending_installation_id"
            ],
            str(
                self.pending_id
            ),
        )

        self.assertNotIn(
            "agent_id",
            kwargs[
                "payload"
            ],
        )


    @patch(
        "agent_portal.views."
        "complete_agent_installation"
    )
    def test_missing_identity_never_calls_service(
        self,
        service,
    ):
        response = self.view.post(
            _request(
                agent_id=None
            ),
            self.pending_id,
        )

        self.assertEqual(
            response.status_code,
            401,
        )

        service.assert_not_called()


    def _assert_mapping(
        self,
        exception,
        expected_status: int,
    ):
        with patch(
            "agent_portal.views."
            "complete_agent_installation",
            side_effect=exception,
        ):
            response = self.view.post(
                _request(
                    agent_id=self.agent_id
                ),
                self.pending_id,
            )

        self.assertEqual(
            response.status_code,
            expected_status,
        )

        self.assertEqual(
            response.data[
                "code"
            ],
            exception.code,
        )


    def test_not_found_maps_404(
        self,
    ):
        self._assert_mapping(
            AgentCompletionNotFoundError(
                "not found"
            ),
            404,
        )


    def test_contract_maps_400(
        self,
    ):
        self._assert_mapping(
            AgentCompletionContractError(
                "contract"
            ),
            400,
        )


    def test_state_maps_409(
        self,
    ):
        self._assert_mapping(
            AgentCompletionStateError(
                "state"
            ),
            409,
        )


    def test_conflict_maps_409(
        self,
    ):
        self._assert_mapping(
            AgentCompletionConflictError(
                "conflict"
            ),
            409,
        )


    def test_storage_maps_503_without_detail_leak(
        self,
    ):
        error = (
            AgentCompletionStorageError(
                "secret storage detail"
            )
        )

        with patch(
            "agent_portal.views."
            "complete_agent_installation",
            side_effect=error,
        ):
            response = self.view.post(
                _request(
                    agent_id=self.agent_id
                ),
                self.pending_id,
            )

        self.assertEqual(
            response.status_code,
            503,
        )

        self.assertEqual(
            response.data[
                "code"
            ],
            error.code,
        )

        self.assertNotIn(
            "secret storage detail",
            str(
                response.data
            ),
        )


    @patch(
        "agent_portal.views."
        "complete_agent_installation"
    )
    def test_idempotent_success_remains_200(
        self,
        service,
    ):
        service.return_value = {
            "ok": True,
            "status": "installed",
            "idempotent": True,
        }

        response = self.view.post(
            _request(
                agent_id=self.agent_id
            ),
            self.pending_id,
        )

        self.assertEqual(
            response.status_code,
            200,
        )

        self.assertTrue(
            response.data[
                "idempotent"
            ]
        )
