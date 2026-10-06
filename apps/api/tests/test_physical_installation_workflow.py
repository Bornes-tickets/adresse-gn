from pathlib import Path

from django.test import SimpleTestCase

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
