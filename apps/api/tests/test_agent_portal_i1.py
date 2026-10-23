from datetime import (
    datetime,
    timezone,
)
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from unittest import TestCase

import agent_portal.permissions as permissions_module
import agent_portal.services as services_module

from agent_portal.permissions import (
    IsActiveFieldAgent,
)
from agent_portal.services import (
    list_agent_tasks,
)


AGENT_ID = (
    "11111111-1111-1111-1111-111111111111"
)

ZONE_ID = (
    "22222222-2222-2222-2222-222222222222"
)

PENDING_ID = (
    "33333333-3333-3333-3333-333333333333"
)

ORDER_ID = (
    "44444444-4444-4444-4444-444444444444"
)

BEACON_ID = (
    "55555555-5555-5555-5555-555555555555"
)

SITE_ID = (
    "66666666-6666-6666-6666-666666666666"
)


class FakeCursor:
    def __init__(
        self,
        *,
        fetchone_result=None,
        fetchall_result=None,
    ):
        self.fetchone_result = (
            fetchone_result
        )
        self.fetchall_result = list(
            fetchall_result or []
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
        return self.fetchone_result

    def fetchall(self):
        return self.fetchall_result

    def __enter__(self):
        return self

    def __exit__(
        self,
        exc_type,
        exc,
        tb,
    ):
        return False


class AgentPermissionTests(
    TestCase
):
    def _request(self):
        return SimpleNamespace(
            user=SimpleNamespace(
                id=AGENT_ID,
            )
        )

    def test_active_agent_is_allowed(
        self,
    ):
        fake = FakeCursor(
            fetchone_result=(
                AGENT_ID,
                "agent",
                "Agent Test",
                "AG-001",
                ZONE_ID,
                True,
            )
        )

        request = self._request()

        with patch.object(
            permissions_module.connection,
            "cursor",
            return_value=fake,
        ):
            allowed = (
                IsActiveFieldAgent()
                .has_permission(
                    request,
                    None,
                )
            )

        self.assertTrue(
            allowed
        )

        self.assertEqual(
            request.agent_identity[
                "user_id"
            ],
            AGENT_ID,
        )

        self.assertEqual(
            request.agent_identity[
                "badge_number"
            ],
            "AG-001",
        )

        self.assertTrue(
            request.agent_identity[
                "active"
            ]
        )

    def test_inactive_agent_is_rejected(
        self,
    ):
        fake = FakeCursor(
            fetchone_result=(
                AGENT_ID,
                "agent",
                "Agent Test",
                "AG-001",
                ZONE_ID,
                False,
            )
        )

        with patch.object(
            permissions_module.connection,
            "cursor",
            return_value=fake,
        ):
            allowed = (
                IsActiveFieldAgent()
                .has_permission(
                    self._request(),
                    None,
                )
            )

        self.assertFalse(
            allowed
        )

    def test_non_agent_role_is_rejected(
        self,
    ):
        fake = FakeCursor(
            fetchone_result=(
                AGENT_ID,
                "support",
                "Support Test",
                "AG-001",
                ZONE_ID,
                True,
            )
        )

        with patch.object(
            permissions_module.connection,
            "cursor",
            return_value=fake,
        ):
            allowed = (
                IsActiveFieldAgent()
                .has_permission(
                    self._request(),
                    None,
                )
            )

        self.assertFalse(
            allowed
        )


class AgentTaskServiceTests(
    TestCase
):
    def _physical_items(
        self,
        *,
        include_version=True,
        version=1,
    ):
        item = {
            "qty": 1,
            "ref": (
                "residentiel_premium"
            ),
            "code": (
                "residentiel_premium"
            ),
            "label": (
                "R?sidentiel Premium"
            ),
            "unit_price_gnf": 200000,
            "fulfillment_kind": (
                "physical_installation"
            ),
            "capabilities": [
                "address_number",
                "qr_code",
                "gps_location",
                "external_navigation",
                "address_sharing",
                "physical_plate",
                "installation_tracking",
                "enhanced_plate",
                "priority_installation_72h",
                "detailed_access_note",
                "replacement_assistance_12m",
            ],
        }

        if include_version:
            item[
                "installation_requirements_version"
            ] = version

        return [
            item
        ]


    def _row(
        self,
        *,
        items=None,
        site_count=1,
        site_id=SITE_ID,
        site_beacon_id=BEACON_ID,
    ):
        scheduled = datetime(
            2026,
            10,
            21,
            9,
            0,
            tzinfo=timezone.utc,
        )

        created = datetime(
            2026,
            10,
            20,
            10,
            0,
            tzinfo=timezone.utc,
        )

        if items is None:
            items = (
                self._physical_items()
            )

        return (
            PENDING_ID,
            "planned",
            scheduled,
            created,

            ORDER_ID,
            "AGN-2026-000001",
            "particulier",
            "Client Test",
            "+224600000000",
            items,

            BEACON_ID,
            "GN-CKY-123456",

            site_id,
            site_beacon_id,
            "residential",
            "Maison",
            None,
            None,
            None,
            "Rue test",
            "Portail principal",

            site_count,
        )


    def _tasks_for_row(
        self,
        row,
    ):
        fake = FakeCursor(
            fetchall_result=[
                row,
            ]
        )

        with patch.object(
            services_module.connection,
            "cursor",
            return_value=fake,
        ):
            tasks = list_agent_tasks(
                agent_id=AGENT_ID,
            )

        return (
            tasks,
            fake,
        )


    def test_paid_snapshot_task_is_independent_of_current_plan(
        self,
    ):
        tasks, fake = (
            self._tasks_for_row(
                self._row()
            )
        )

        self.assertEqual(
            len(tasks),
            1,
        )

        task = tasks[0]

        self.assertEqual(
            task[
                "pending_installation_id"
            ],
            PENDING_ID,
        )

        self.assertEqual(
            task["plan"]["code"],
            "residentiel_premium",
        )

        self.assertEqual(
            task["plan"][
                "fulfillment_kind"
            ],
            "physical_installation",
        )

        self.assertEqual(
            task["plan"][
                "installation_requirements_version"
            ],
            1,
        )

        self.assertTrue(
            task[
                "installation_requirements"
            ][
                "access_point_note_required"
            ]
        )

        self.assertTrue(
            task[
                "can_start_installation"
            ]
        )

        self.assertTrue(
            task[
                "site_contract"
            ][
                "valid"
            ]
        )

        self.assertEqual(
            len(
                fake.executed
            ),
            1,
        )

        sql, params = (
            fake.executed[0]
        )

        self.assertIn(
            "pi.assigned_agent_id = %s",
            sql,
        )

        self.assertIn(
            (
                "pi.status IN "
                "( 'assigned', 'planned' )"
            ),
            sql,
        )

        self.assertIn(
            "o.status = 'paid'",
            sql,
        )

        self.assertIn(
            "o.items",
            sql,
        )

        self.assertIn(
            "LEFT JOIN LATERAL",
            sql,
        )

        self.assertIn(
            "COUNT(*)::integer AS site_count",
            sql,
        )

        # A paid historical purchase must not disappear
        # if its current catalogue plan is disabled or changed.
        self.assertNotIn(
            "cms_plans",
            sql,
        )

        self.assertNotIn(
            "cp.active",
            sql,
        )

        self.assertNotIn(
            "cp.fulfillment_kind",
            sql,
        )

        self.assertEqual(
            params,
            [
                AGENT_ID,
            ],
        )


    def test_zero_site_is_visible_but_not_startable(
        self,
    ):
        tasks, _ = (
            self._tasks_for_row(
                self._row(
                    site_count=0,
                    site_id=None,
                    site_beacon_id=None,
                )
            )
        )

        self.assertEqual(
            len(tasks),
            1,
        )

        self.assertFalse(
            tasks[0][
                "can_start_installation"
            ]
        )

        self.assertEqual(
            tasks[0][
                "site_contract"
            ][
                "site_count"
            ],
            0,
        )

        self.assertFalse(
            tasks[0][
                "site_contract"
            ][
                "valid"
            ]
        )


    def test_multiple_sites_are_visible_but_not_startable(
        self,
    ):
        tasks, _ = (
            self._tasks_for_row(
                self._row(
                    site_count=2,
                )
            )
        )

        self.assertEqual(
            len(tasks),
            1,
        )

        self.assertFalse(
            tasks[0][
                "can_start_installation"
            ]
        )

        self.assertEqual(
            tasks[0][
                "site_contract"
            ][
                "site_count"
            ],
            2,
        )

        self.assertFalse(
            tasks[0][
                "site_contract"
            ][
                "valid"
            ]
        )


    def test_single_site_with_wrong_beacon_is_not_startable(
        self,
    ):
        tasks, _ = (
            self._tasks_for_row(
                self._row(
                    site_count=1,
                    site_beacon_id=(
                        "77777777-7777-7777-7777-777777777777"
                    ),
                )
            )
        )

        self.assertEqual(
            len(tasks),
            1,
        )

        self.assertFalse(
            tasks[0][
                "can_start_installation"
            ]
        )

        self.assertFalse(
            tasks[0][
                "site_contract"
            ][
                "matches_beacon"
            ]
        )


    def test_missing_requirement_version_fails_closed(
        self,
    ):
        tasks, _ = (
            self._tasks_for_row(
                self._row(
                    items=(
                        self._physical_items(
                            include_version=False,
                        )
                    )
                )
            )
        )

        self.assertEqual(
            tasks,
            [],
        )


    def test_unknown_requirement_version_fails_closed(
        self,
    ):
        tasks, _ = (
            self._tasks_for_row(
                self._row(
                    items=(
                        self._physical_items(
                            version=999,
                        )
                    )
                )
            )
        )

        self.assertEqual(
            tasks,
            [],
        )


class AgentPortalSourceContractTests(
    TestCase
):
    def test_urls_are_mounted(
        self,
    ):
        root = (
            Path(__file__)
            .resolve()
            .parents[1]
        )

        agent_urls = (
            root
            / "agent_portal"
            / "urls.py"
        ).read_text(
            encoding="utf-8"
        )

        config_urls = (
            root
            / "config"
            / "urls.py"
        ).read_text(
            encoding="utf-8"
        )

        self.assertIn(
            '"me/"',
            agent_urls,
        )

        self.assertIn(
            '"tasks/"',
            agent_urls,
        )

        self.assertIn(
            'include("agent_portal.urls")',
            config_urls,
        )

    def test_i1_agent_portal_contains_no_write_sql(
        self,
    ):
        root = (
            Path(__file__)
            .resolve()
            .parents[1]
            / "agent_portal"
        )

        combined = "\n".join(
            path.read_text(
                encoding="utf-8"
            )
            for path in root.glob(
                "*.py"
            )
        ).upper()

        forbidden = [
            "INSERT INTO ",
            "UPDATE PUBLIC.",
            "DELETE FROM ",
        ]

        unexpected = [
            token
            for token in forbidden
            if token in combined
        ]

        self.assertEqual(
            unexpected,
            [],
        )

    def test_field_complete_is_not_exposed_by_i1(
        self,
    ):
        root = (
            Path(__file__)
            .resolve()
            .parents[1]
            / "agent_portal"
        )

        combined = "\n".join(
            path.read_text(
                encoding="utf-8"
            )
            for path in root.glob(
                "*.py"
            )
        )

        self.assertNotIn(
            "field-complete",
            combined,
        )

        self.assertNotIn(
            "record_physical_installation",
            combined,
        )

        self.assertNotIn(
            "installation_measures",
            combined,
        )
