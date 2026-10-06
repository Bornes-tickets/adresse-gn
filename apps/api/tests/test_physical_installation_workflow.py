from datetime import datetime, timezone
from pathlib import Path
from unittest import TestCase as UnitTestCase
from unittest.mock import patch

from django.test import SimpleTestCase

import backoffice.physical_installation_workflow as workflow_service

from backoffice.serializers import (
    PhysicalInstallationAssignSerializer,
    PhysicalInstallationScheduleSerializer,
)


class PhysicalInstallationWorkflowSerializerTests(SimpleTestCase):
    def test_assign_requires_agent_id(self):
        serializer = PhysicalInstallationAssignSerializer(data={})
        self.assertFalse(serializer.is_valid())
        self.assertIn("agent_id", serializer.errors)

    def test_schedule_accepts_iso_datetime(self):
        serializer = PhysicalInstallationScheduleSerializer(
            data={"scheduled_at": "2026-10-05T09:30:00Z"}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)


class PhysicalInstallationWorkflowSourceTests(SimpleTestCase):
    def test_workflow_service_contract(self):
        root = Path(__file__).resolve().parents[1]
        source = (
            root / "backoffice" / "physical_installation_workflow.py"
        ).read_text(encoding="utf-8")

        required = [
            "assign_physical_installation",
            "schedule_physical_installation",
            "installation.assign.v1",
            "installation.schedule.v1",
            "installation.validate.v1",
            "validate_physical_installation",
            "address.publish.v1",
            "publish_physical_address",
            "visibility = 'public'",
            "status = 'assigned'",
            "status = 'planned'",
            "status = 'done'",
            "verification_level = 'verified'",
            '"visibility": "private"',
            "FOR UPDATE OF pi, o",
        ]

        for token in required:
            self.assertIn(token, source)

    def test_migration_adds_installed_state(self):
        repo_root = Path(__file__).resolve().parents[3]
        migration = (
            repo_root
            / "supabase"
            / "migrations"
            / "20261004183000_phase16c5_r12_installation_workflow_states.sql"
        ).read_text(encoding="utf-8")

        self.assertIn("'installed'::text", migration)
        self.assertIn("pending_installations_status_check", migration)

    def test_reassignment_service_contract(self):
        root = Path(__file__).resolve().parents[1]

        source = (
            root
            / "backoffice"
            / "physical_installation_workflow.py"
        ).read_text(
            encoding="utf-8"
        )

        required = [
            "reassign_physical_installation",
            "installation.reassign.v1",
            "previous_agent_id",
            "status IN ('assigned', 'planned')",
            "assigned_agent_id = %s",
            "La reaffectation a ete modifiee concurremment.",
            '"idempotent": True',
        ]

        for token in required:
            self.assertIn(
                token,
                source,
            )

        urls_source = (
            root
            / "backoffice"
            / "urls.py"
        ).read_text(
            encoding="utf-8"
        )

        views_source = (
            root
            / "backoffice"
            / "views.py"
        ).read_text(
            encoding="utf-8"
        )

        self.assertIn(
            '"reassign/"',
            urls_source,
        )

        self.assertIn(
            "PhysicalInstallationReassignView",
            views_source,
        )


PUBLISH_PENDING_ID = (
    "11111111-1111-1111-1111-111111111111"
)

PUBLISH_ORDER_ID = (
    "22222222-2222-2222-2222-222222222222"
)

PUBLISH_BEACON_ID = (
    "33333333-3333-3333-3333-333333333333"
)

PUBLISH_ADDRESS_ID = (
    "44444444-4444-4444-4444-444444444444"
)

PUBLISH_ACTOR_ID = (
    "55555555-5555-5555-5555-555555555555"
)

PUBLISH_NUMBER = (
    "BFA01-100000000"
)

PUBLISH_COMPLETED_AT = datetime(
    2026,
    10,
    6,
    20,
    0,
    0,
    tzinfo=timezone.utc,
)


class PublishFakeCursor:

    def __init__(
        self,
        *,
        fetchone_results=None,
        fetchall_results=None,
        address_update_rowcount=1,
    ):
        self.fetchone_results = list(
            fetchone_results or []
        )

        self.fetchall_results = list(
            fetchall_results or []
        )

        self.address_update_rowcount = (
            address_update_rowcount
        )

        self.executed = []

        self.rowcount = -1

    def execute(
        self,
        sql,
        params=None,
    ):
        normalized = " ".join(
            str(sql).split()
        )

        self.executed.append(
            (
                normalized,
                params,
            )
        )

        if (
            "UPDATE public.addresses"
            in normalized
        ):
            self.rowcount = (
                self.address_update_rowcount
            )
        else:
            self.rowcount = 1

    def fetchone(self):

        if not self.fetchone_results:
            return None

        return self.fetchone_results.pop(0)

    def fetchall(self):

        if not self.fetchall_results:
            return []

        return self.fetchall_results.pop(0)

    def __enter__(self):
        return self

    def __exit__(
        self,
        exc_type,
        exc,
        tb,
    ):
        return False


def _publish_pending_row(
    *,
    status="done",
    completed_at=PUBLISH_COMPLETED_AT,
):
    return (
        PUBLISH_PENDING_ID,
        PUBLISH_ORDER_ID,
        status,
        PUBLISH_BEACON_ID,
        completed_at,
        "paid",
        "physical_installation",
    )


def _publish_address_row(
    *,
    visibility="private",
    verification_level="verified",
    address_status="active",
    beacon_status="active",
):
    return (
        PUBLISH_ADDRESS_ID,
        visibility,
        verification_level,
        address_status,
        beacon_status,
        PUBLISH_NUMBER,
    )


def _publish_audit_calls(
    fake,
):
    result = []

    for sql, params in fake.executed:

        if not params:
            continue

        if (
            "address.publish.v1"
            in params
        ):
            result.append(
                (
                    sql,
                    params,
                )
            )

    return result


class PhysicalAddressPublishBehaviorTests(
    UnitTestCase
):

    def _core(self):
        return getattr(
            workflow_service.publish_physical_address,
            "__wrapped__",
            workflow_service.publish_physical_address,
        )

    def test_publish_verified_private_active_address_succeeds_and_audits_once(
        self,
    ):
        fake = PublishFakeCursor(
            fetchone_results=[
                _publish_pending_row(),
            ],
            fetchall_results=[
                [
                    _publish_address_row(),
                ],
            ],
            address_update_rowcount=1,
        )

        with patch.object(
            workflow_service.connection,
            "cursor",
            return_value=fake,
        ):
            result = self._core()(
                pending_installation_id=(
                    PUBLISH_PENDING_ID
                ),
                actor_id=PUBLISH_ACTOR_ID,
            )

        self.assertTrue(
            result["ok"]
        )

        self.assertEqual(
            result["status"],
            "published",
        )

        self.assertFalse(
            result["idempotent"]
        )

        self.assertEqual(
            result["visibility"],
            "public",
        )

        self.assertEqual(
            result["verification_level"],
            "verified",
        )

        self.assertEqual(
            result["public_number"],
            PUBLISH_NUMBER,
        )

        sql = "\n".join(
            item[0]
            for item in fake.executed
        )

        self.assertIn(
            "UPDATE public.addresses",
            sql,
        )

        self.assertIn(
            "SET visibility = 'public'",
            sql,
        )

        audit_calls = (
            _publish_audit_calls(
                fake
            )
        )

        self.assertEqual(
            len(audit_calls),
            1,
        )

    def test_publish_replay_is_idempotent_without_update_or_new_audit(
        self,
    ):
        fake = PublishFakeCursor(
            fetchone_results=[
                _publish_pending_row(),
            ],
            fetchall_results=[
                [
                    _publish_address_row(
                        visibility="public",
                    ),
                ],
            ],
        )

        with patch.object(
            workflow_service.connection,
            "cursor",
            return_value=fake,
        ):
            result = self._core()(
                pending_installation_id=(
                    PUBLISH_PENDING_ID
                ),
                actor_id=PUBLISH_ACTOR_ID,
            )

        self.assertTrue(
            result["ok"]
        )

        self.assertTrue(
            result["idempotent"]
        )

        self.assertEqual(
            result["status"],
            "published",
        )

        sql = "\n".join(
            item[0]
            for item in fake.executed
        )

        self.assertNotIn(
            "UPDATE public.addresses",
            sql,
        )

        self.assertEqual(
            _publish_audit_calls(fake),
            [],
        )

    def test_publish_rejects_workflow_before_done(
        self,
    ):
        fake = PublishFakeCursor(
            fetchone_results=[
                _publish_pending_row(
                    status="installed",
                    completed_at=None,
                ),
            ],
        )

        with patch.object(
            workflow_service.connection,
            "cursor",
            return_value=fake,
        ):
            with self.assertRaises(
                workflow_service
                .PhysicalWorkflowStateError
            ):
                self._core()(
                    pending_installation_id=(
                        PUBLISH_PENDING_ID
                    ),
                    actor_id=PUBLISH_ACTOR_ID,
                )

        self.assertEqual(
            len(fake.executed),
            1,
        )

        self.assertEqual(
            _publish_audit_calls(fake),
            [],
        )

    def test_publish_rejects_done_without_completed_at(
        self,
    ):
        fake = PublishFakeCursor(
            fetchone_results=[
                _publish_pending_row(
                    status="done",
                    completed_at=None,
                ),
            ],
        )

        with patch.object(
            workflow_service.connection,
            "cursor",
            return_value=fake,
        ):
            with self.assertRaises(
                workflow_service
                .PhysicalWorkflowStateError
            ):
                self._core()(
                    pending_installation_id=(
                        PUBLISH_PENDING_ID
                    ),
                    actor_id=PUBLISH_ACTOR_ID,
                )

        self.assertEqual(
            len(fake.executed),
            1,
        )

        self.assertEqual(
            _publish_audit_calls(fake),
            [],
        )

    def test_publish_rejects_unverified_address(
        self,
    ):
        fake = PublishFakeCursor(
            fetchone_results=[
                _publish_pending_row(),
            ],
            fetchall_results=[
                [
                    _publish_address_row(
                        verification_level=(
                            "pending"
                        ),
                    ),
                ],
            ],
        )

        with patch.object(
            workflow_service.connection,
            "cursor",
            return_value=fake,
        ):
            with self.assertRaises(
                workflow_service
                .PhysicalWorkflowStateError
            ):
                self._core()(
                    pending_installation_id=(
                        PUBLISH_PENDING_ID
                    ),
                    actor_id=PUBLISH_ACTOR_ID,
                )

        sql = "\n".join(
            item[0]
            for item in fake.executed
        )

        self.assertNotIn(
            "UPDATE public.addresses",
            sql,
        )

        self.assertEqual(
            _publish_audit_calls(fake),
            [],
        )

    def test_publish_rejects_inactive_address(
        self,
    ):
        fake = PublishFakeCursor(
            fetchone_results=[
                _publish_pending_row(),
            ],
            fetchall_results=[
                [
                    _publish_address_row(
                        address_status=(
                            "suspended"
                        ),
                    ),
                ],
            ],
        )

        with patch.object(
            workflow_service.connection,
            "cursor",
            return_value=fake,
        ):
            with self.assertRaises(
                workflow_service
                .PhysicalWorkflowStateError
            ):
                self._core()(
                    pending_installation_id=(
                        PUBLISH_PENDING_ID
                    ),
                    actor_id=PUBLISH_ACTOR_ID,
                )

        sql = "\n".join(
            item[0]
            for item in fake.executed
        )

        self.assertNotIn(
            "UPDATE public.addresses",
            sql,
        )

        self.assertEqual(
            _publish_audit_calls(fake),
            [],
        )

    def test_publish_rejects_inactive_beacon(
        self,
    ):
        fake = PublishFakeCursor(
            fetchone_results=[
                _publish_pending_row(),
            ],
            fetchall_results=[
                [
                    _publish_address_row(
                        beacon_status=(
                            "suspended"
                        ),
                    ),
                ],
            ],
        )

        with patch.object(
            workflow_service.connection,
            "cursor",
            return_value=fake,
        ):
            with self.assertRaises(
                workflow_service
                .PhysicalWorkflowStateError
            ):
                self._core()(
                    pending_installation_id=(
                        PUBLISH_PENDING_ID
                    ),
                    actor_id=PUBLISH_ACTOR_ID,
                )

        sql = "\n".join(
            item[0]
            for item in fake.executed
        )

        self.assertNotIn(
            "UPDATE public.addresses",
            sql,
        )

        self.assertEqual(
            _publish_audit_calls(fake),
            [],
        )

    def test_publish_concurrent_update_is_rejected_without_audit(
        self,
    ):
        fake = PublishFakeCursor(
            fetchone_results=[
                _publish_pending_row(),
            ],
            fetchall_results=[
                [
                    _publish_address_row(),
                ],
            ],
            address_update_rowcount=0,
        )

        with patch.object(
            workflow_service.connection,
            "cursor",
            return_value=fake,
        ):
            with self.assertRaises(
                workflow_service
                .PhysicalWorkflowStateError
            ):
                self._core()(
                    pending_installation_id=(
                        PUBLISH_PENDING_ID
                    ),
                    actor_id=PUBLISH_ACTOR_ID,
                )

        sql = "\n".join(
            item[0]
            for item in fake.executed
        )

        self.assertIn(
            "UPDATE public.addresses",
            sql,
        )

        self.assertEqual(
            _publish_audit_calls(fake),
            [],
        )
