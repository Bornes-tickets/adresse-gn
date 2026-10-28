from pathlib import Path

from django.test import SimpleTestCase

import backoffice.generic_installation_requests as service


class GenericInstallationRequestPureValidationTests(
    SimpleTestCase
):
    def test_supported_sources_are_complete(self):
        self.assertEqual(
            service.SOURCE_TYPES,
            {
                "customer_order",
                "institutional",
                "internal",
                "campaign",
                "replacement",
                "regularization",
                "other",
            },
        )

    def test_non_customer_request_does_not_require_order(self):
        payload = service._normalize_create_payload(
            source_type="internal",
            title="Déploiement interne CKY03",
            category="residential",
            quantity=5,
            commune_id=(
                "11111111-1111-1111-1111-111111111111"
            ),
        )

        self.assertEqual(
            payload["source_type"],
            "internal",
        )
        self.assertIsNone(
            payload["order_id"]
        )
        self.assertEqual(
            payload["quantity"],
            5,
        )

    def test_customer_order_requires_order_id(self):
        with self.assertRaises(
            service.GenericInstallationRequestValidationError
        ):
            service._normalize_create_payload(
                source_type="customer_order",
                title="Commande physique",
                category="residential",
                quantity=1,
                commune_id=(
                    "11111111-1111-1111-1111-111111111111"
                ),
            )

    def test_invalid_quantity_is_rejected(self):
        with self.assertRaises(
            service.GenericInstallationRequestValidationError
        ):
            service._normalize_create_payload(
                source_type="campaign",
                title="Campagne",
                category="residential",
                quantity=0,
                commune_id=(
                    "11111111-1111-1111-1111-111111111111"
                ),
            )

    def test_partial_coordinates_are_rejected(self):
        with self.assertRaises(
            service.GenericInstallationRequestValidationError
        ):
            service._normalize_create_payload(
                source_type="institutional",
                title="Institution",
                category="residential",
                quantity=2,
                commune_id=(
                    "11111111-1111-1111-1111-111111111111"
                ),
                requested_lat=9.64,
                requested_lng=None,
            )

    def test_coordinates_and_accuracy_are_normalized(self):
        payload = service._normalize_create_payload(
            source_type="campaign",
            title="Campagne",
            category="residential",
            quantity="3",
            commune_id=(
                "11111111-1111-1111-1111-111111111111"
            ),
            requested_lat=9.64,
            requested_lng=-13.58,
            location_accuracy_m=2.5,
        )

        self.assertEqual(
            payload["requested_lat"],
            9.64,
        )
        self.assertEqual(
            payload["requested_lng"],
            -13.58,
        )
        self.assertEqual(
            payload["location_accuracy_m"],
            2.5,
        )
        self.assertEqual(
            payload["quantity"],
            3,
        )


class GenericInstallationRequestSourceContractTests(
    SimpleTestCase
):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.source = Path(
            service.__file__
        ).read_text(
            encoding="utf-8"
        )

    def test_service_exposes_a2_lifecycle(self):
        required = [
            "def create_installation_request(",
            "def submit_installation_request(",
            "def approve_installation_request(",
            "def cancel_installation_request(",
            "@transaction.atomic",
            "FOR UPDATE",
        ]

        for token in required:
            with self.subTest(
                token=token,
            ):
                self.assertIn(
                    token,
                    self.source,
                )

    def test_approval_generates_exact_quantity_atomically(self):
        required = [
            "generate_series(",
            "ir.quantity",
            "generated.sequence_no",
            "len(generated_rows)",
            '!= before["quantity"]',
            "La génération atomique des tâches est incomplète.",
        ]

        for token in required:
            with self.subTest(
                token=token,
            ):
                self.assertIn(
                    token,
                    self.source,
                )

    def test_new_tasks_start_without_assignment(self):
        required = [
            "NULL,\n                NULL,\n                NULL,\n                'pending'",
            "beacon_id is not None",
            "assigned_agent_id is not None",
            "installation_id is not None",
            "A2 ne doit affecter ni balise, ni agent, ni installation.",
        ]

        for token in required:
            with self.subTest(
                token=token,
            ):
                self.assertIn(
                    token,
                    self.source,
                )

        forbidden = [
            "status = 'assigned'",
            "UPDATE public.beacons",
            "INSERT INTO public.installations",
        ]

        for token in forbidden:
            with self.subTest(
                forbidden=token,
            ):
                self.assertNotIn(
                    token,
                    self.source,
                )

    def test_reference_generation_is_transaction_serialized(self):
        required = [
            "REQ-",
            "pg_advisory_xact_lock",
            '"installation_requests."',
            'f"reference.{year}"',
            "MAX(",
            "RIGHT(",
        ]

        for token in required:
            with self.subTest(
                token=token,
            ):
                self.assertIn(
                    token,
                    self.source,
                )

    def test_reference_scope_validation_exists(self):
        required = [
            "public.beacon_categories",
            "public.communes",
            "public.districts",
            "d.commune_id = %s",
            "public.sectors",
            "JOIN public.districts d",
            "ON d.id = s.district_id",
            "d.commune_id = %s",
            "OR s.district_id = %s",
            "public.orders",
            '"profiles"',
            '"business_profiles"',
            "FROM public.{table}",
        ]

        for token in required:
            with self.subTest(
                token=token,
            ):
                self.assertIn(
                    token,
                    self.source,
                )

    def test_audit_is_systematic_for_all_mutations(self):
        required = [
            "installation_request.create.v1",
            "installation_request.submit.v1",
            "installation_request.approve.v1",
            "installation_request.cancel.v1",
            "INSERT INTO public.audit_logs",
        ]

        for token in required:
            with self.subTest(
                token=token,
            ):
                self.assertIn(
                    token,
                    self.source,
                )

    def test_a2_does_not_touch_legacy_or_cutover_consumers(self):
        a2_source = self.source.split(
            (
                "# R9-P5-H4-A3 — customer order "
                "-> generic installation adapter"
            ),
            1,
        )[0]

        forbidden = [
            "pending_installations",
            "UPDATE public.orders",
            "UPDATE public.order_sites",
            "payments/services.py",
            "action_catalog.py",
            "global_resources.py",
        ]

        for token in forbidden:
            with self.subTest(
                forbidden=token,
            ):
                self.assertNotIn(
                    token,
                    a2_source,
                )

    def test_cancel_only_cancels_unengaged_tasks(self):
        required = [
            '"pending",\n                "cancelled",',
            "La demande possède déjà des tâches engagées sur le terrain.",
            "AND status = 'pending'",
            "status = 'cancelled'",
            "cancelled_at = NOW()",
            "ORDER BY sequence_no\n            FOR UPDATE",
        ]

        for token in required:
            with self.subTest(
                token=token,
            ):
                self.assertIn(
                    token,
                    self.source,
                )
