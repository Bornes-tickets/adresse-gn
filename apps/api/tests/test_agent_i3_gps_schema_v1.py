from __future__ import annotations

from pathlib import Path

from django.test import SimpleTestCase


ROOT = (
    Path(__file__)
    .resolve()
    .parents[3]
)

MIGRATION = (
    ROOT
    / "supabase"
    / "migrations"
    / "20261021093500_agent_gps_measure_contract_v1.sql"
)


class AgentGpsSchemaV1MigrationTests(
    SimpleTestCase
):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.sql = MIGRATION.read_text(
            encoding="utf-8",
            errors="strict",
        )

        cls.upper = cls.sql.upper()

        cls.compact = " ".join(
            cls.sql.split()
        )


    def test_adds_nullable_sequence_no_without_backfill(
        self,
    ):
        self.assertIn(
            "ADD COLUMN sequence_no smallint",
            self.sql,
        )

        self.assertNotIn(
            "sequence_no smallint NOT NULL",
            self.sql,
        )

        self.assertNotIn(
            "UPDATE PUBLIC.INSTALLATION_MEASURES",
            self.upper,
        )

        self.assertNotIn(
            "INSERT INTO PUBLIC.INSTALLATION_MEASURES",
            self.upper,
        )

        self.assertNotIn(
            "DELETE FROM PUBLIC.INSTALLATION_MEASURES",
            self.upper,
        )


    def test_sequence_number_is_limited_to_one_through_three(
        self,
    ):
        self.assertIn(
            "installation_measures_sequence_no_v1_check",
            self.sql,
        )

        self.assertIn(
            "sequence_no BETWEEN 1 AND 3",
            self.sql,
        )


    def test_historical_rows_are_exempt_from_agent_v1_guards(
        self,
    ):
        self.assertGreaterEqual(
            self.sql.count(
                "sequence_no IS NULL"
            ),
            2,
        )

        self.assertIn(
            "NULL identifies historical or legacy rows",
            self.sql,
        )


    def test_new_agent_rows_require_complete_raw_payload(
        self,
    ):
        required = [
            "installation_id IS NOT NULL",
            "lat IS NOT NULL",
            "lat BETWEEN -90 AND 90",
            "lng IS NOT NULL",
            "lng BETWEEN -180 AND 180",
            "accuracy_m IS NOT NULL",
            "accuracy_m >= 0",
            "accuracy_m <= 3.0",
            "taken_at IS NOT NULL",
        ]

        for token in required:
            with self.subTest(
                token=token
            ):
                self.assertIn(
                    token,
                    self.sql,
                )


    def test_sequence_is_unique_per_installation(
        self,
    ):
        self.assertIn(
            "CREATE UNIQUE INDEX "
            "installation_measures_installation_sequence_v1_uidx",
            self.sql,
        )

        self.assertIn(
            "ON public.installation_measures "
            "( installation_id, sequence_no ) "
            "WHERE sequence_no IS NOT NULL;",
            self.compact,
        )


    def test_migration_does_not_make_historical_payload_columns_not_null(
        self,
    ):
        forbidden = [
            "ALTER COLUMN INSTALLATION_ID SET NOT NULL",
            "ALTER COLUMN LAT SET NOT NULL",
            "ALTER COLUMN LNG SET NOT NULL",
            "ALTER COLUMN ACCURACY_M SET NOT NULL",
            "ALTER COLUMN TAKEN_AT SET NOT NULL",
        ]

        for token in forbidden:
            with self.subTest(
                token=token
            ):
                self.assertNotIn(
                    token,
                    self.upper,
                )


    def test_no_snap_or_routing_configuration_is_added(
        self,
    ):
        lowered = self.sql.lower()

        self.assertNotIn(
            "snap_radius",
            lowered,
        )

        self.assertNotIn(
            "pgrouting",
            lowered,
        )

        self.assertNotIn(
            "nearest_road",
            lowered,
        )


    def test_exactly_three_remains_service_transaction_contract(
        self,
    ):
        self.assertIn(
            "Exactly-three cardinality is enforced transactionally",
            self.sql,
        )

        self.assertNotIn(
            "CREATE TRIGGER",
            self.upper,
        )

        self.assertNotIn(
            "CREATE CONSTRAINT TRIGGER",
            self.upper,
        )
