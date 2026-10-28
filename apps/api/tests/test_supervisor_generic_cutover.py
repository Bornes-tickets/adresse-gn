from __future__ import annotations

from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[3]


class SupervisorGenericCutoverSourceTests(unittest.TestCase):
    def text(self, relative: str) -> str:
        return (ROOT / relative).read_text(encoding="utf-8")

    def test_generic_workflow_is_dispatch_only(self):
        text = self.text(
            "apps/api/backoffice/generic_supervisor_workflow.py"
        )
        self.assertIn("def assign_generic_installation_task(", text)
        self.assertIn("def reassign_generic_installation_task(", text)
        self.assertIn("def schedule_generic_installation_task(", text)
        self.assertNotIn("activated_at = NOW()", text)
        self.assertNotIn("status = 'installed'", text)
        self.assertNotIn("status = 'validated'", text)

    def test_customer_order_keeps_h2_bridge(self):
        text = self.text(
            "apps/api/backoffice/generic_supervisor_workflow.py"
        )
        self.assertIn('if source_type == "customer_order":', text)
        self.assertIn("assign_physical_installation(", text)
        self.assertIn("reassign_physical_installation(", text)
        self.assertIn("schedule_physical_installation(", text)

    def test_stock_compatibility_contract(self):
        text = self.text(
            "apps/api/backoffice/generic_supervisor_workflow.py"
        )
        self.assertIn('beacon["category"]', text)
        self.assertIn('task["category"]', text)
        self.assertIn('beacon["commune_code_at_issue"]', text)
        self.assertIn('task["commune_code"]', text)
        self.assertIn("lot_id", text)

    def test_resources_prefer_generic_and_preserve_legacy(self):
        text = self.text(
            "apps/api/backoffice/global_resources.py"
        )
        self.assertIn("FROM public.installation_tasks it", text)
        self.assertIn("FROM public.pending_installations pi", text)
        self.assertIn("AND NOT EXISTS (", text)
        self.assertIn("irx.source_type = 'customer_order'", text)

    def test_generic_planning_is_read_only_from_legacy_plan_actions(self):
        resources = self.text(
            "apps/api/backoffice/global_resources.py"
        )
        catalog = self.text(
            "apps/api/backoffice/action_catalog.py"
        )
        self.assertIn("'generic_task'::text AS record_kind", resources)
        self.assertIn("'legacy_plan'::text AS record_kind", resources)
        self.assertIn(
            'when={"record_kind": ["legacy_plan"]}',
            catalog,
        )

    def test_available_stock_action_targets_generic_task(self):
        catalog = self.text(
            "apps/api/backoffice/action_catalog.py"
        )
        actions = self.text(
            "apps/api/backoffice/global_actions.py"
        )
        self.assertIn('"installation_task_id"', catalog)
        self.assertIn(
            'source="pending_generic_installation_tasks"',
            catalog,
        )
        self.assertIn("assign_generic_installation_task(", actions)

    def test_installation_actions_route_generic_or_legacy(self):
        actions = self.text(
            "apps/api/backoffice/global_actions.py"
        )
        self.assertIn("def _supervisor_dispatch_action(", actions)
        self.assertIn("generic_installation_task_exists(", actions)
        self.assertIn("return _physical_action(", actions)

    def test_no_schema_mutation_added(self):
        all_text = "\n".join(
            self.text(path)
            for path in (
                "apps/api/backoffice/generic_supervisor_workflow.py",
                "apps/api/backoffice/global_actions.py",
                "apps/api/backoffice/action_catalog.py",
                "apps/api/backoffice/action_common.py",
                "apps/api/backoffice/global_resources.py",
            )
        )
        self.assertNotIn("CREATE TABLE", all_text)
        self.assertNotIn("ALTER TABLE", all_text)
        self.assertNotIn("DROP TABLE", all_text)


if __name__ == "__main__":
    unittest.main()
