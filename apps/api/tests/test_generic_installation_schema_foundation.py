from pathlib import Path

from django.test import SimpleTestCase


class GenericInstallationSchemaFoundationTests(
    SimpleTestCase
):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.repo_root = (
            Path(__file__)
            .resolve()
            .parents[3]
        )

        cls.migration_path = (
            cls.repo_root
            / "supabase"
            / "migrations"
            / "20261026233000_r9_p5_h4_a1_generic_installation_schema.sql"
        )

        cls.sql = (
            cls.migration_path
            .read_text(
                encoding="utf-8"
            )
        )


    def test_creates_generic_request_and_task_tables(self):
        self.assertIn(
            "CREATE TABLE public.installation_requests",
            self.sql,
        )

        self.assertIn(
            "CREATE TABLE public.installation_tasks",
            self.sql,
        )

        self.assertIn(
            "installation_requests_order_id_fkey",
            self.sql,
        )

        self.assertIn(
            "installation_tasks_request_id_fkey",
            self.sql,
        )


    def test_request_sources_are_not_customer_order_only(self):
        required = [
            "'customer_order'::text",
            "'institutional'::text",
            "'internal'::text",
            "'campaign'::text",
            "'replacement'::text",
            "'regularization'::text",
            "'other'::text",
            "installation_requests_customer_order_link_check",
        ]

        for token in required:
            with self.subTest(
                token=token,
            ):
                self.assertIn(
                    token,
                    self.sql,
                )


    def test_task_lifecycle_is_generic_and_unit_based(self):
        required = [
            "'pending'::text",
            "'assigned'::text",
            "'planned'::text",
            "'installed'::text",
            "'validated'::text",
            "'cancelled'::text",
            "installation_tasks_assignment_state_check",
            "request_id uuid",
            "sequence_no integer",
            "beacon_id uuid",
            "assigned_agent_id uuid",
            "installation_id uuid",
            "target_location geography(Point, 4326)",
        ]

        for token in required:
            with self.subTest(
                token=token,
            ):
                self.assertIn(
                    token,
                    self.sql,
                )


    def test_commercial_links_are_optional_compatibility_links(self):
        self.assertIn(
            "order_id uuid",
            self.sql,
        )

        self.assertIn(
            "source_order_site_id uuid",
            self.sql,
        )

        self.assertNotIn(
            "order_id uuid\n        NOT NULL",
            self.sql,
        )

        self.assertNotIn(
            "source_order_site_id uuid\n        NOT NULL",
            self.sql,
        )


    def test_dispatch_and_uniqueness_indexes_exist(self):
        required = [
            "installation_requests_one_per_order_uidx",
            "idx_installation_requests_commune_category",
            "idx_installation_tasks_dispatch",
            "idx_installation_tasks_agent",
            "installation_tasks_active_beacon_uidx",
            "installation_tasks_installation_uidx",
        ]

        for token in required:
            with self.subTest(
                token=token,
            ):
                self.assertIn(
                    token,
                    self.sql,
                )


    def test_rls_and_least_privilege_contract_exist(self):
        required = [
            "ALTER TABLE public.installation_requests",
            "ALTER TABLE public.installation_tasks",
            "ENABLE ROW LEVEL SECURITY",
            "installation_requests_read_scope",
            "installation_requests_supervisor_insert",
            "installation_requests_supervisor_update",
            "installation_tasks_read_scope",
            "installation_tasks_supervisor_insert",
            "installation_tasks_supervisor_update",
            "private.current_account_is_active()",
            "private.current_role_is(",
            "FROM anon",
            "TO authenticated",
            "TO service_role",
        ]

        for token in required:
            with self.subTest(
                token=token,
            ):
                self.assertIn(
                    token,
                    self.sql,
                )


    def test_foundation_has_no_backfill_or_legacy_cutover(self):
        forbidden = [
            "ALTER TABLE public.pending_installations",
            "UPDATE public.pending_installations",
            "INSERT INTO public.pending_installations",
            "DELETE FROM public.pending_installations",
            "UPDATE public.orders",
            "INSERT INTO public.orders",
            "UPDATE public.order_sites",
            "INSERT INTO public.order_sites",
            "UPDATE public.installations",
            "INSERT INTO public.installations",
        ]

        for token in forbidden:
            with self.subTest(
                token=token,
            ):
                self.assertNotIn(
                    token,
                    self.sql,
                )


    def test_foundation_contains_strict_pre_and_postconditions(self):
        required = [
            "H4-A1: public.installation_requests already exists",
            "H4-A1: public.installation_tasks already exists",
            "private.current_role_is(text[])",
            "private.current_account_is_active()",
            "H4-A1 post: generic installation tables missing",
            "foundation migration must not backfill business rows",
        ]

        for token in required:
            with self.subTest(
                token=token,
            ):
                self.assertIn(
                    token,
                    self.sql,
                )
