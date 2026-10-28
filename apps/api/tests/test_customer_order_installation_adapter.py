from pathlib import Path

from django.test import SimpleTestCase


class CustomerOrderInstallationAdapterSourceTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        root = Path(__file__).resolve().parents[1]

        cls.service = (
            root
            / "backoffice"
            / "generic_installation_requests.py"
        ).read_text(
            encoding="utf-8"
        )

        cls.payments = (
            root
            / "payments"
            / "services.py"
        ).read_text(
            encoding="utf-8"
        )

    def test_generic_adapter_contract(self):
        required = (
            "def ensure_customer_order_installation_request(",
            'source_type="customer_order"',
            "quantity=1",
            "source_order_site_id = %s",
            "installation_request.customer_order_adapter.v1",
        )

        for token in required:
            with self.subTest(token=token):
                self.assertIn(
                    token,
                    self.service,
                )

    def test_adapter_requires_paid_pending_legacy_state(self):
        required = (
            '!= "paid"',
            "pi.status AS legacy_pending_status",
            "legacy_pending_status",
            ') != "pending"',
            "JOIN public.pending_installations pi",
            "JOIN public.beacons b",
        )

        for token in required:
            with self.subTest(token=token):
                self.assertIn(
                    token,
                    self.service,
                )

    def test_generic_task_stays_unassigned(self):
        required = (
            "task_beacon_id is not None",
            "task_agent_id is not None",
            "task_installation_id is not None",
            "A3 ne doit affecter ni balise, ni agent, ni installation.",
        )

        for token in required:
            with self.subTest(token=token):
                self.assertIn(
                    token,
                    self.service,
                )

    def test_payment_core_imports_adapter(self):
        self.assertIn(
            "from backoffice.generic_installation_requests import (",
            self.payments,
        )
        self.assertIn(
            "ensure_customer_order_installation_request,",
            self.payments,
        )

    def test_confirmation_result_exposes_pending_legacy_status(self):
        required = (
            "pi.status AS pending_installation_status",
            '"pending_installation_status": str(row[2])',
            '"public_number": str(row[3])',
            '"address_id": str(row[4])',
        )

        for token in required:
            with self.subTest(token=token):
                self.assertIn(
                    token,
                    self.payments,
                )

    def test_success_replay_repairs_only_pending_legacy(self):
        start = self.payments.index(
            'if row["payment_status"] == "success":'
        )
        end = self.payments.index(
            'if row["payment_status"] != "pending":',
            start,
        )

        block = self.payments[start:end]

        required = (
            '"pending_installation_status"',
            '== "pending"',
            "ensure_customer_order_installation_request(",
            '"skipped": True',
            '"legacy_installation_not_pending"',
            '"generic_installation": generic_installation,',
        )

        for token in required:
            with self.subTest(token=token):
                self.assertIn(
                    token,
                    block,
                )

    def test_first_confirmation_adapter_runs_after_order_paid(self):
        start = self.payments.index(
            "def confirm_manual_payment_core("
        )

        paid = self.payments.index(
            "status = 'paid'",
            start,
        )

        adapter = self.payments.index(
            "generic_installation = (",
            paid,
        )

        notification = self.payments.index(
            "INSERT INTO public.notifications",
            paid,
        )

        self.assertLess(
            paid,
            adapter,
        )
        self.assertLess(
            adapter,
            notification,
        )

    def test_final_confirmation_result_exposes_generic_layer(self):
        start = self.payments.index(
            "def confirm_manual_payment_core("
        )

        end = self.payments.index(
            "PHASE 15G2B11",
            start,
        )

        block = self.payments[start:end]

        self.assertIn(
            '"generic_installation": generic_installation,',
            block,
        )

    def test_legacy_h2_is_preserved(self):
        required = (
            "def _fulfill_physical_installation(",
            "INSERT INTO public.pending_installations",
            "UPDATE public.pending_installations",
            "fulfillment = _fulfill_physical_installation(",
            "'available'",
            "lot_id",
        )

        for token in required:
            with self.subTest(token=token):
                self.assertIn(
                    token,
                    self.payments,
                )

    def test_a3_has_no_supervisor_or_agent_cutover(self):
        adapter = self.service.split(
            "R9-P5-H4-A3 — customer order -> generic installation adapter",
            1,
        )[1]

        forbidden = (
            "physical_installation_workflow",
            "assign_to_request",
            "supervisor_available_beacons",
            "assigned_agent_id =",
            "status = 'assigned'",
            "status = 'planned'",
            "UPDATE public.beacons",
            "INSERT INTO public.installations",
        )

        for token in forbidden:
            with self.subTest(forbidden=token):
                self.assertNotIn(
                    token,
                    adapter,
                )
