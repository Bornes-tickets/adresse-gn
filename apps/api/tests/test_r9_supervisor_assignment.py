import ast
from pathlib import Path
from unittest import TestCase


REPO = Path(__file__).resolve().parents[3]


class R9SupervisorAssignmentSourceTests(TestCase):
    def source(self, relative: str) -> str:
        return (REPO / relative).read_text(encoding="utf-8")

    def test_payment_preallocates_physical_v1_as_available_not_activated(self):
        source = self.source("apps/api/payments/services.py")

        start = source.index("def _fulfill_physical_installation(")
        end = source.index("@transaction.atomic", start)
        block = source[start:end]

        expected = """            VALUES (\n                %s,\n                'available',\n                %s,\n                NULL,\n                NULL,\n                %s,\n                %s,\n                %s,\n                'v1'\n            )"""
        self.assertIn(expected, block)
        self.assertNotIn("'active',\n                %s,\n                NULL,\n                NOW()", block)

    def test_supervisor_owns_dispatch_actions_and_sales_is_read_only(self):
        source = self.source("apps/api/backoffice/action_catalog.py")

        supervisor_start = source.index('"supervisor_installations": [')
        supervisor_end = source.index('"supervisor_planning": [', supervisor_start)
        supervisor = source[supervisor_start:supervisor_end]

        for token in (
            '"assign"',
            '"reassign"',
            '"schedule"',
            '"draw_qc"',
            '"validate"',
            '"reject"',
            'source="active_agents"',
        ):
            self.assertIn(token, supervisor)

        self.assertIn('"sales_installations": []', source)
        self.assertIn('when={"record_kind": ["qc"]}', supervisor)

    def test_global_actions_route_dispatch_only_from_supervisor_resource(self):
        source = self.source("apps/api/backoffice/global_actions.py")

        self.assertIn(
            'if resource == "supervisor_installations":',
            source,
        )
        self.assertIn(
            'if action in {"assign", "reassign", "schedule"}:',
            source,
        )
        self.assertNotIn(
            'if resource == "sales_installations" and action in '
            '{"assign", "reassign", "schedule"}:',
            source,
        )

    def test_initial_assignment_is_available_to_assigned_atomically(self):
        source = self.source(
            "apps/api/backoffice/physical_installation_workflow.py"
        )

        required = (
            "FOR UPDATE OF pi, o",
            "FOR UPDATE OF ag",
            "FROM public.beacons",
            "numbering_version = 'v1'",
            'str(beacon_status) != "available"',
            "status = 'assigned',",
            "assigned_agent_id = %s",
            "AND status = 'available'",
            "UPDATE public.pending_installations",
            "status = 'assigned',",
            "installation.assign.v1",
        )
        for token in required:
            self.assertIn(token, source)

    def test_reassignment_preserves_assigned_beacon_and_syncs_agent(self):
        source = self.source(
            "apps/api/backoffice/physical_installation_workflow.py"
        )

        self.assertIn('str(beacon_status) != "assigned"', source)
        self.assertIn("AND status = 'assigned'", source)
        self.assertIn("installation.reassign.v1", source)
        self.assertIn("UPDATE public.pending_installations", source)

    def test_schedule_requires_assigned_beacon_without_beacon_state_update(self):
        source = self.source(
            "apps/api/backoffice/physical_installation_workflow.py"
        )

        start = source.index("def schedule_physical_installation(")
        end = source.index("def _load_validation_targets(", start)
        block = source[start:end]

        self.assertIn('str(beacon_status) != "assigned"', block)
        self.assertIn("installation.schedule.v1", block)
        self.assertNotIn("UPDATE public.beacons", block)

    def test_supervisor_resource_contains_dispatch_and_qc_rows(self):
        source = self.source("apps/api/backoffice/global_resources.py")

        configs = source.index("RESOURCE_CONFIGS = {")
        start = source.index('"supervisor_installations": {', configs)
        end = source.index('"supervisor_planning": {', start)
        block = source[start:end]

        required = (
            "'dispatch'::text AS record_kind",
            "FROM public.pending_installations pi",
            "pi.status IN ('pending', 'assigned', 'planned')",
            "'pending'",
            "'assigned'",
            "'planned'",
            "UNION ALL",
            "'qc'::text AS record_kind",
            "FROM public.installations i",
            "validation_status",
        )
        for token in required:
            self.assertIn(token, block)

        self.assertEqual(
            block.count("NULL::numeric AS gps_lat"),
            2,
        )
        self.assertEqual(
            block.count("NULL::numeric AS gps_lng"),
            2,
        )
        self.assertEqual(
            block.count("NULL::numeric AS accuracy_m"),
            2,
        )
        self.assertNotIn(
            "                NULL AS gps_lat,",
            block,
        )
        self.assertNotIn(
            "                NULL AS gps_lng,",
            block,
        )
        self.assertNotIn(
            "                NULL AS accuracy_m,",
            block,
        )

    def test_supervisor_resource_roles_are_sets_and_include_admin_hierarchy(self):
        source = self.source("apps/api/backoffice/global_resources.py")
        tree = ast.parse(source)

        roles_node = None
        for node in tree.body:
            if not isinstance(node, ast.Assign):
                continue
            if any(
                isinstance(target, ast.Name)
                and target.id == "RESOURCE_ROLES"
                for target in node.targets
            ):
                roles_node = node.value
                break

        self.assertIsNotNone(roles_node)
        roles = ast.literal_eval(roles_node)

        for resource, allowed in roles.items():
            self.assertIsInstance(
                allowed,
                set,
                f"{resource} must map to a set of roles",
            )

        expected = {"supervisor", "admin", "super_admin"}
        self.assertEqual(roles["supervisor_installations"], expected)
        self.assertEqual(roles["supervisor_planning"], expected)

    def test_available_beacons_provider_is_not_needed_for_canonical_preallocation(self):
        common = self.source("apps/api/backoffice/action_common.py")
        catalog = self.source("apps/api/backoffice/action_catalog.py")

        self.assertNotIn(
            "def available_beacons_options(",
            common,
        )
        self.assertNotIn(
            'source="available_beacons"',
            catalog,
        )
        self.assertIn(
            '"supervisor_available_beacons": [',
            catalog,
        )
        self.assertIn(
            'source="available_physical_beacons"',
            catalog,
        )

    def test_r9_p4_terrain_lifecycle_is_assigned_installed_active(self):
        terrain = self.source(
            "apps/api/backoffice/physical_installations.py"
        )
        agent = self.source(
            "apps/api/agent_installations/services.py"
        )
        workflow = self.source(
            "apps/api/backoffice/physical_installation_workflow.py"
        )

        terrain_start = terrain.index("def record_physical_installation(")
        terrain_block = terrain[terrain_start:]
        self.assertIn('str(beacon_status) != "assigned"', terrain_block)
        self.assertIn("UPDATE public.beacons", terrain_block)
        self.assertIn("SET status = 'installed'", terrain_block)
        self.assertIn("AND assigned_agent_id = %s", terrain_block)
        self.assertIn("AND activated_at IS NULL", terrain_block)

        agent_start = agent.index("def complete_agent_installation(")
        agent_block = agent[agent_start:]
        self.assertIn(') != "assigned":', agent_block)
        self.assertIn("UPDATE public.beacons", agent_block)
        self.assertIn("status = 'installed'", agent_block)
        self.assertIn("numbering_version = 'v1'", agent_block)
        self.assertIn("assigned_agent_id = %s", agent_block)
        self.assertNotIn("activated_at = NOW()", agent_block)

        validate_start = workflow.index("def validate_physical_installation(")
        publish_start = workflow.index("def publish_physical_address(", validate_start)
        validate_block = workflow[validate_start:publish_start]
        publish_block = workflow[publish_start:]

        self.assertIn('str(beacon_status) != "installed"', validate_block)
        self.assertIn("UPDATE public.beacons", validate_block)
        self.assertIn("status = 'active'", validate_block)
        self.assertIn("activated_at = NOW()", validate_block)
        self.assertIn("status = 'done'", validate_block)
        self.assertIn("completed_at = NOW()", validate_block)

        self.assertIn('str(beacon_status) != "active"', publish_block)
        self.assertIn("visibility = 'public'", publish_block)
        self.assertNotIn("UPDATE public.beacons", publish_block)

    def test_ui_copy_matches_authority_split(self):
        supervisor = self.source(
            "apps/web/src/features/backoffice/components/"
            "supervisor-professional-pages.tsx"
        )
        sales = self.source(
            "apps/web/src/app/sales/installations/page.tsx"
        )

        start = supervisor.index(
            "export function SupervisorInstallationsQcPage()"
        )
        block = supervisor[start:]

        self.assertIn(
            'useSupervisorResource(\n      "supervisor_installations"',
            block,
        )
        self.assertIn(
            'title="Installations & contrôle QC"',
            block,
        )
        self.assertIn(
            "Contrôlez uniquement les installations "
            "de la nouvelle codification V1.",
            block,
        )
        self.assertIn(
            "lecture seule",
            sales,
        )


if __name__ == "__main__":
    import unittest

    unittest.main()
