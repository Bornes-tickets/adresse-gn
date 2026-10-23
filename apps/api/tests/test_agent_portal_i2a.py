import json
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

import agent_portal.services as services_module

from agent_portal.services import (
    AgentAuthServiceError,
    AgentInvalidCredentialsError,
    authenticate_agent_badge,
)


AGENT_ID = (
    "11111111-1111-1111-1111-111111111111"
)


class FakeCursor:
    def __init__(
        self,
        rows,
    ):
        self.rows = list(rows)
        self.executed = []

    def execute(
        self,
        sql,
        params=None,
    ):
        self.executed.append(
            (
                " ".join(
                    str(sql).split()
                ),
                params,
            )
        )

    def fetchall(self):
        return list(
            self.rows
        )

    def __enter__(self):
        return self

    def __exit__(
        self,
        exc_type,
        exc,
        tb,
    ):
        return False


class FakeResponse:
    def __init__(
        self,
        payload,
    ):
        self.payload = payload

    def read(self):
        return json.dumps(
            self.payload
        ).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(
        self,
        exc_type,
        exc,
        tb,
    ):
        return False


class AgentBadgeLoginTests(
    TestCase
):
    def test_active_agent_can_authenticate(
        self,
    ):
        fake_cursor = FakeCursor(
            [
                (
                    AGENT_ID,
                    "agent",
                    True,
                    "agent@example.test",
                )
            ]
        )

        response = FakeResponse(
            {
                "access_token": "access-test",
                "refresh_token": "refresh-test",
                "expires_in": 3600,
                "token_type": "bearer",
            }
        )

        with patch.object(
            services_module.connection,
            "cursor",
            return_value=fake_cursor,
        ), patch.object(
            services_module,
            "urlopen",
            return_value=response,
        ) as mocked_urlopen:
            result = (
                authenticate_agent_badge(
                    badge_number="AGN-001",
                    password="secret-test",
                )
            )

        self.assertEqual(
            result["access_token"],
            "access-test",
        )

        self.assertEqual(
            result["refresh_token"],
            "refresh-test",
        )

        self.assertNotIn(
            "email",
            result,
        )

        request = (
            mocked_urlopen
            .call_args
            .args[0]
        )

        payload = json.loads(
            request.data.decode(
                "utf-8"
            )
        )

        self.assertEqual(
            payload["email"],
            "agent@example.test",
        )

        self.assertEqual(
            payload["password"],
            "secret-test",
        )

    def test_inactive_agent_is_rejected_before_supabase(
        self,
    ):
        fake_cursor = FakeCursor(
            [
                (
                    AGENT_ID,
                    "agent",
                    False,
                    "agent@example.test",
                )
            ]
        )

        with patch.object(
            services_module.connection,
            "cursor",
            return_value=fake_cursor,
        ), patch.object(
            services_module,
            "urlopen",
        ) as mocked_urlopen:
            with self.assertRaises(
                AgentInvalidCredentialsError
            ):
                authenticate_agent_badge(
                    badge_number="AGN-001",
                    password="secret-test",
                )

        mocked_urlopen.assert_not_called()

    def test_non_agent_role_is_rejected(
        self,
    ):
        fake_cursor = FakeCursor(
            [
                (
                    AGENT_ID,
                    "support",
                    True,
                    "agent@example.test",
                )
            ]
        )

        with patch.object(
            services_module.connection,
            "cursor",
            return_value=fake_cursor,
        ), patch.object(
            services_module,
            "urlopen",
        ) as mocked_urlopen:
            with self.assertRaises(
                AgentInvalidCredentialsError
            ):
                authenticate_agent_badge(
                    badge_number="AGN-001",
                    password="secret-test",
                )

        mocked_urlopen.assert_not_called()

    def test_unknown_badge_is_rejected(
        self,
    ):
        fake_cursor = FakeCursor(
            []
        )

        with patch.object(
            services_module.connection,
            "cursor",
            return_value=fake_cursor,
        ), patch.object(
            services_module,
            "urlopen",
        ) as mocked_urlopen:
            with self.assertRaises(
                AgentInvalidCredentialsError
            ):
                authenticate_agent_badge(
                    badge_number="UNKNOWN",
                    password="secret-test",
                )

        mocked_urlopen.assert_not_called()

    def test_incomplete_supabase_session_is_rejected(
        self,
    ):
        fake_cursor = FakeCursor(
            [
                (
                    AGENT_ID,
                    "agent",
                    True,
                    "agent@example.test",
                )
            ]
        )

        response = FakeResponse(
            {
                "access_token": (
                    "access-test"
                ),
            }
        )

        with patch.object(
            services_module.connection,
            "cursor",
            return_value=fake_cursor,
        ), patch.object(
            services_module,
            "urlopen",
            return_value=response,
        ):
            with self.assertRaises(
                AgentAuthServiceError
            ):
                authenticate_agent_badge(
                    badge_number="AGN-001",
                    password="secret-test",
                )


class AgentBadgeLoginSourceTests(
    TestCase
):
    def test_login_does_not_expose_agent_email(
        self,
    ):
        result_keys = {
            "access_token",
            "refresh_token",
            "expires_in",
            "token_type",
        }

        self.assertNotIn(
            "email",
            result_keys,
        )
