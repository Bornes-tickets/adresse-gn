from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.test import APIRequestFactory

from config.authentication import (
    SupabaseJWTAuthentication,
    _ensure_active_application_account,
)


USER_ID = "7534ef08-ec07-49a9-98fa-ed864794b5e2"


def cursor_context(row):
    cursor = MagicMock()
    cursor.fetchone.return_value = row

    context = MagicMock()
    context.__enter__.return_value = cursor
    context.__exit__.return_value = False

    return context


class AccountLifecycleAuthenticationTests(SimpleTestCase):
    def setUp(self):
        self.cutoff = datetime(
            2026,
            9,
            17,
            10,
            0,
            tzinfo=timezone.utc,
        )

    @patch("config.authentication.connection")
    def test_active_account_without_cutoff_is_allowed(
        self,
        connection_mock,
    ):
        connection_mock.cursor.return_value = cursor_context(
            ("active", None)
        )

        _ensure_active_application_account(
            USER_ID,
            {},
        )

        self.assertEqual(
            connection_mock.cursor.call_count,
            1,
        )

    @patch("config.authentication.connection")
    def test_deactivated_account_is_rejected(
        self,
        connection_mock,
    ):
        connection_mock.cursor.return_value = cursor_context(
            ("deactivated", None)
        )

        with self.assertRaises(AuthenticationFailed):
            _ensure_active_application_account(
                USER_ID,
                {},
            )

    @patch("config.authentication.connection")
    def test_reactivated_account_requires_session_id(
        self,
        connection_mock,
    ):
        connection_mock.cursor.return_value = cursor_context(
            ("active", self.cutoff)
        )

        with self.assertRaises(AuthenticationFailed):
            _ensure_active_application_account(
                USER_ID,
                {},
            )

    @patch("config.authentication.connection")
    def test_unknown_session_is_rejected(
        self,
        connection_mock,
    ):
        connection_mock.cursor.side_effect = [
            cursor_context(("active", self.cutoff)),
            cursor_context(None),
        ]

        with self.assertRaises(AuthenticationFailed):
            _ensure_active_application_account(
                USER_ID,
                {"session_id": "session-missing"},
            )

    @patch("config.authentication.connection")
    def test_session_before_cutoff_is_rejected(
        self,
        connection_mock,
    ):
        connection_mock.cursor.side_effect = [
            cursor_context(("active", self.cutoff)),
            cursor_context(
                (
                    self.cutoff - timedelta(seconds=1),
                )
            ),
        ]

        with self.assertRaises(AuthenticationFailed):
            _ensure_active_application_account(
                USER_ID,
                {"session_id": "session-old"},
            )

    @patch("config.authentication.connection")
    def test_session_equal_to_cutoff_is_rejected(
        self,
        connection_mock,
    ):
        connection_mock.cursor.side_effect = [
            cursor_context(("active", self.cutoff)),
            cursor_context((self.cutoff,)),
        ]

        with self.assertRaises(AuthenticationFailed):
            _ensure_active_application_account(
                USER_ID,
                {"session_id": "session-equal"},
            )

    @patch("config.authentication.connection")
    def test_session_after_cutoff_is_allowed(
        self,
        connection_mock,
    ):
        connection_mock.cursor.side_effect = [
            cursor_context(("active", self.cutoff)),
            cursor_context(
                (
                    self.cutoff + timedelta(seconds=1),
                )
            ),
        ]

        _ensure_active_application_account(
            USER_ID,
            {"session_id": "session-fresh"},
        )

        self.assertEqual(
            connection_mock.cursor.call_count,
            2,
        )

    @patch(
        "config.authentication._ensure_active_application_account"
    )
    @patch(
        "config.authentication.verify_supabase_access_token"
    )
    def test_pipeline_forwards_claims_to_lifecycle_guard(
        self,
        verify_mock,
        lifecycle_mock,
    ):
        claims = {
            "sub": USER_ID,
            "email": "test@example.invalid",
            "role": "authenticated",
            "session_id": "session-fresh",
        }

        verify_mock.return_value = claims

        request = APIRequestFactory().get(
            "/test",
            HTTP_AUTHORIZATION="Bearer test-token",
        )

        principal, returned_claims = (
            SupabaseJWTAuthentication().authenticate(request)
        )

        lifecycle_mock.assert_called_once_with(
            USER_ID,
            claims,
        )

        self.assertEqual(principal.id, USER_ID)
        self.assertEqual(returned_claims, claims)

    def test_no_bearer_header_returns_none(self):
        request = APIRequestFactory().get("/test")

        result = (
            SupabaseJWTAuthentication().authenticate(request)
        )

        self.assertIsNone(result)
