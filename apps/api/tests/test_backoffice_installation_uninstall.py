from datetime import (
    datetime,
    timezone,
)
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch
from uuid import UUID

from backoffice.installations import (
    register_installation_uninstall,
)
from backoffice.permissions import (
    IsInstallationBackofficeUser,
)
from backoffice.serializers import (
    InstallationUninstallSerializer,
)

import backoffice.installations as installation_service
import backoffice.permissions as installation_permissions


INSTALLATION_ID = UUID(
    "11111111-1111-1111-1111-111111111111"
)

BEACON_ID = UUID(
    "22222222-2222-2222-2222-222222222222"
)

ACTOR_ID = UUID(
    "33333333-3333-3333-3333-333333333333"
)

AGENT_ID = UUID(
    "44444444-4444-4444-4444-444444444444"
)

AUDIT_ID = UUID(
    "55555555-5555-5555-5555-555555555555"
)

UNINSTALLED_AT = datetime(
    2026,
    9,
    30,
    20,
    0,
    0,
    tzinfo=timezone.utc,
)


class FakeCursor:

    def __init__(
        self,
        fetchone_results,
    ):
        self.fetchone_results = list(
            fetchone_results
        )
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

    def fetchone(self):
        if not self.fetchone_results:
            return None

        return self.fetchone_results.pop(0)

    def __enter__(self):
        return self

    def __exit__(
        self,
        exc_type,
        exc,
        tb,
    ):
        return False


def installation_row(
    *,
    uninstalled_at=None,
    status="suspended",
    numbering_version="legacy",
):
    return (
        INSTALLATION_ID,
        BEACON_ID,
        uninstalled_at,
        None,
        None,
        None,
        "GN-CKY-100004",
        status,
        numbering_version,
    )


class InstallationUninstallSerializerTests(
    TestCase
):

    def test_valid_payload(self):
        serializer = (
            InstallationUninstallSerializer(
                data={
                    "agent_id": str(
                        AGENT_ID
                    ),
                    "reason": (
                        "Retrait migration V1."
                    ),
                    "photo_url": None,
                }
            )
        )

        self.assertTrue(
            serializer.is_valid(),
            serializer.errors,
        )

    def test_blank_reason_is_rejected(self):
        serializer = (
            InstallationUninstallSerializer(
                data={
                    "agent_id": str(
                        AGENT_ID
                    ),
                    "reason": "   ",
                }
            )
        )

        self.assertFalse(
            serializer.is_valid()
        )


class InstallationUninstallPermissionTests(
    TestCase
):

    def _request(self):
        return SimpleNamespace(
            user=SimpleNamespace(
                id=str(
                    ACTOR_ID
                )
            )
        )

    def test_admin_is_allowed(self):
        fake = FakeCursor(
            [
                (
                    ACTOR_ID,
                    "admin",
                    "Admin test",
                ),
            ]
        )

        with patch.object(
            installation_permissions
            .connection,
            "cursor",
            return_value=fake,
        ):
            request = self._request()

            allowed = (
                IsInstallationBackofficeUser()
                .has_permission(
                    request,
                    None,
                )
            )

        self.assertTrue(
            allowed
        )

        self.assertEqual(
            request.backoffice_identity[
                "role"
            ],
            "admin",
        )

    def test_support_is_rejected(self):
        fake = FakeCursor(
            [
                (
                    ACTOR_ID,
                    "support",
                    "Support test",
                ),
            ]
        )

        with patch.object(
            installation_permissions
            .connection,
            "cursor",
            return_value=fake,
        ):
            allowed = (
                IsInstallationBackofficeUser()
                .has_permission(
                    self._request(),
                    None,
                )
            )

        self.assertFalse(
            allowed
        )


class InstallationUninstallServiceTests(
    TestCase
):

    def _core(self):
        return getattr(
            register_installation_uninstall,
            "__wrapped__",
            register_installation_uninstall,
        )

    def test_success_updates_and_audits(self):
        fake = FakeCursor(
            [
                installation_row(),
                (
                    AGENT_ID,
                    True,
                ),
                (
                    UNINSTALLED_AT,
                    AGENT_ID,
                    "Retrait migration V1.",
                    None,
                ),
                (
                    AUDIT_ID,
                ),
            ]
        )

        with patch.object(
            installation_service
            .connection,
            "cursor",
            return_value=fake,
        ):
            result = self._core()(
                installation_id=str(
                    INSTALLATION_ID
                ),
                actor_id=str(
                    ACTOR_ID
                ),
                agent_id=str(
                    AGENT_ID
                ),
                reason=(
                    "Retrait migration V1."
                ),
                photo_url=None,
            )

        self.assertTrue(
            result["ok"]
        )

        self.assertEqual(
            result["status"],
            "uninstalled",
        )

        self.assertEqual(
            result["public_number"],
            "GN-CKY-100004",
        )

        self.assertEqual(
            result["audit_id"],
            str(
                AUDIT_ID
            ),
        )

        sql = "\n".join(
            item[0]
            for item in fake.executed
        )

        self.assertIn(
            "FOR UPDATE OF i, b",
            sql,
        )

        self.assertIn(
            "UPDATE public.installations",
            sql,
        )

        self.assertIn(
            "INSERT INTO public.audit_logs",
            sql,
        )

        self.assertIn(
            "'installation.uninstall'",
            sql,
        )

    def test_not_found(self):
        fake = FakeCursor(
            [
                None,
            ]
        )

        with patch.object(
            installation_service
            .connection,
            "cursor",
            return_value=fake,
        ):
            result = self._core()(
                installation_id=str(
                    INSTALLATION_ID
                ),
                actor_id=str(
                    ACTOR_ID
                ),
                agent_id=str(
                    AGENT_ID
                ),
                reason="Retrait.",
            )

        self.assertEqual(
            result["status"],
            "not_found",
        )

        self.assertEqual(
            len(fake.executed),
            1,
        )

    def test_already_uninstalled_is_rejected(self):
        fake = FakeCursor(
            [
                installation_row(
                    uninstalled_at=(
                        UNINSTALLED_AT
                    )
                ),
            ]
        )

        with patch.object(
            installation_service
            .connection,
            "cursor",
            return_value=fake,
        ):
            result = self._core()(
                installation_id=str(
                    INSTALLATION_ID
                ),
                actor_id=str(
                    ACTOR_ID
                ),
                agent_id=str(
                    AGENT_ID
                ),
                reason="Retrait.",
            )

        self.assertEqual(
            result["status"],
            "already_uninstalled",
        )

        self.assertEqual(
            len(fake.executed),
            1,
        )

    def test_v1_installation_is_rejected(self):
        fake = FakeCursor(
            [
                installation_row(
                    numbering_version="v1"
                ),
            ]
        )

        with patch.object(
            installation_service
            .connection,
            "cursor",
            return_value=fake,
        ):
            result = self._core()(
                installation_id=str(
                    INSTALLATION_ID
                ),
                actor_id=str(
                    ACTOR_ID
                ),
                agent_id=str(
                    AGENT_ID
                ),
                reason="Retrait.",
            )

        self.assertEqual(
            result["status"],
            "invalid_numbering_version",
        )

    def test_non_suspended_legacy_is_rejected(self):
        fake = FakeCursor(
            [
                installation_row(
                    status="active"
                ),
            ]
        )

        with patch.object(
            installation_service
            .connection,
            "cursor",
            return_value=fake,
        ):
            result = self._core()(
                installation_id=str(
                    INSTALLATION_ID
                ),
                actor_id=str(
                    ACTOR_ID
                ),
                agent_id=str(
                    AGENT_ID
                ),
                reason="Retrait.",
            )

        self.assertEqual(
            result["status"],
            "invalid_beacon_state",
        )

    def test_missing_agent_is_rejected(self):
        fake = FakeCursor(
            [
                installation_row(),
                None,
            ]
        )

        with patch.object(
            installation_service
            .connection,
            "cursor",
            return_value=fake,
        ):
            result = self._core()(
                installation_id=str(
                    INSTALLATION_ID
                ),
                actor_id=str(
                    ACTOR_ID
                ),
                agent_id=str(
                    AGENT_ID
                ),
                reason="Retrait.",
            )

        self.assertEqual(
            result["status"],
            "agent_not_found",
        )

    def test_inactive_agent_is_rejected(self):
        fake = FakeCursor(
            [
                installation_row(),
                (
                    AGENT_ID,
                    False,
                ),
            ]
        )

        with patch.object(
            installation_service
            .connection,
            "cursor",
            return_value=fake,
        ):
            result = self._core()(
                installation_id=str(
                    INSTALLATION_ID
                ),
                actor_id=str(
                    ACTOR_ID
                ),
                agent_id=str(
                    AGENT_ID
                ),
                reason="Retrait.",
            )

        self.assertEqual(
            result["status"],
            "agent_inactive",
        )

    def test_empty_reason_is_rejected_before_database(self):
        with patch.object(
            installation_service
            .connection,
            "cursor",
        ) as cursor_mock:

            result = self._core()(
                installation_id=str(
                    INSTALLATION_ID
                ),
                actor_id=str(
                    ACTOR_ID
                ),
                agent_id=str(
                    AGENT_ID
                ),
                reason="   ",
            )

        self.assertEqual(
            result["status"],
            "invalid_reason",
        )

        cursor_mock.assert_not_called()

    def test_concurrent_second_update_is_rejected(self):
        fake = FakeCursor(
            [
                installation_row(),
                (
                    AGENT_ID,
                    True,
                ),
                None,
            ]
        )

        with patch.object(
            installation_service
            .connection,
            "cursor",
            return_value=fake,
        ):
            result = self._core()(
                installation_id=str(
                    INSTALLATION_ID
                ),
                actor_id=str(
                    ACTOR_ID
                ),
                agent_id=str(
                    AGENT_ID
                ),
                reason="Retrait.",
            )

        self.assertEqual(
            result["status"],
            "already_uninstalled",
        )

        sql = "\n".join(
            item[0]
            for item in fake.executed
        )

        self.assertNotIn(
            "INSERT INTO public.audit_logs",
            sql,
        )