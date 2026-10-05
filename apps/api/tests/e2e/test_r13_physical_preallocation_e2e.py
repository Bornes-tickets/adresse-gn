"""
R13 real PostgreSQL/PostGIS E2E.

This test intentionally does NOT use Django TestCase or the Django
test database lifecycle.

Expected execution order:

1. Apply tests/e2e/r13_bootstrap.sql to the dedicated local Docker DB.
2. Run this file with config.settings_e2e.
3. The test consumes national ID 58274136.
4. Reapply the bootstrap before every new execution.

Never run against Supabase or a remote PostgreSQL database.
"""

import json
import os
import re
import unittest
from uuid import UUID

import django


os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "config.settings_e2e",
)

django.setup()


from django.db import connection, transaction  # noqa: E402

from payments.services import (  # noqa: E402
    _validate_fulfillment_items,
    confirm_manual_payment_core,
)

from backoffice.physical_installations import (  # noqa: E402
    record_physical_installation,
)


EXPECTED_DATABASE = "adresse_gn_e2e"
EXPECTED_USER = "adresse_gn_e2e"

FIRST_NATIONAL_ID = "58274136"

EXPECTED_COMMUNE_CODE = "CKY01"


class R13PhysicalPreallocationE2ETest(
    unittest.TestCase
):

    @staticmethod
    def one(sql, params=None):
        with connection.cursor() as cursor:
            cursor.execute(
                sql,
                params or [],
            )
            return cursor.fetchone()

    @staticmethod
    def all_rows(sql, params=None):
        with connection.cursor() as cursor:
            cursor.execute(
                sql,
                params or [],
            )
            return cursor.fetchall()

    @classmethod
    def counts(cls):
        tables = [
            "beacons",
            "addresses",
            "pending_installations",
            "installations",
            "notifications",
            "audit_logs",
        ]

        result = {}

        with connection.cursor() as cursor:
            for table in tables:
                cursor.execute(
                    f"""
                    SELECT COUNT(*)
                    FROM public.{table}
                    """
                )

                result[table] = int(
                    cursor.fetchone()[0]
                )

        return result

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        current_db, current_user = cls.one(
            """
            SELECT
                current_database(),
                current_user
            """
        )

        if current_db != EXPECTED_DATABASE:
            raise RuntimeError(
                "R13 E2E SAFETY: unexpected database."
            )

        if current_user != EXPECTED_USER:
            raise RuntimeError(
                "R13 E2E SAFETY: unexpected DB user."
            )

        last_value, is_called = cls.one(
            """
            SELECT
                last_value,
                is_called
            FROM public.address_national_id_seq
            """
        )

        if (
            int(last_value) != 58274136
            or is_called is not False
        ):
            raise RuntimeError(
                "R13 E2E database is not pristine. "
                "Reapply r13_bootstrap.sql."
            )

        current_counts = cls.counts()

        for table in (
            "beacons",
            "addresses",
            "pending_installations",
            "installations",
            "notifications",
            "audit_logs",
        ):
            if current_counts[table] != 0:
                raise RuntimeError(
                    "R13 E2E database is not pristine: "
                    f"{table}={current_counts[table]}"
                )

    def test_physical_preallocation_replay_and_field_complete(
        self,
    ):
        items = [
            {
                "qty": 1,
                "fulfillment_kind":
                    "physical_installation",
            }
        ]

        validated = _validate_fulfillment_items(
            items=items,
            fulfillment_kind=
                "physical_installation",
        )

        self.assertEqual(
            validated,
            items,
        )

        # -------------------------------------------------------------
        # Fixtures
        # -------------------------------------------------------------

        with transaction.atomic():

            with connection.cursor() as cursor:

                cursor.execute(
                    """
                    INSERT INTO public.profiles (
                        full_name,
                        phone,
                        role
                    )
                    VALUES (
                        'R13 E2E Customer',
                        '+224620000001',
                        'user'
                    )
                    RETURNING id
                    """
                )
                customer_id = cursor.fetchone()[0]

                cursor.execute(
                    """
                    INSERT INTO public.profiles (
                        full_name,
                        phone,
                        role
                    )
                    VALUES (
                        'R13 E2E Actor',
                        '+224620000002',
                        'admin'
                    )
                    RETURNING id
                    """
                )
                actor_id = cursor.fetchone()[0]

                cursor.execute(
                    """
                    INSERT INTO public.profiles (
                        full_name,
                        phone,
                        role
                    )
                    VALUES (
                        'R13 E2E Agent',
                        '+224620000003',
                        'agent'
                    )
                    RETURNING id
                    """
                )
                agent_id = cursor.fetchone()[0]

                cursor.execute(
                    """
                    INSERT INTO public.regions (
                        code,
                        name
                    )
                    VALUES (
                        'CKY',
                        'Conakry E2E'
                    )
                    RETURNING id
                    """
                )
                region_id = cursor.fetchone()[0]

                cursor.execute(
                    """
                    INSERT INTO public.communes (
                        region_id,
                        name,
                        code,
                        is_active
                    )
                    VALUES (
                        %s,
                        'Kaloum E2E',
                        'CKY01',
                        TRUE
                    )
                    RETURNING id
                    """,
                    [
                        region_id,
                    ],
                )
                commune_id = cursor.fetchone()[0]

                cursor.execute(
                    """
                    INSERT INTO public.districts (
                        commune_id,
                        name
                    )
                    VALUES (
                        %s,
                        'District R13 E2E'
                    )
                    RETURNING id
                    """,
                    [
                        commune_id,
                    ],
                )
                district_id = cursor.fetchone()[0]

                cursor.execute(
                    """
                    INSERT INTO public.sectors (
                        district_id,
                        name
                    )
                    VALUES (
                        %s,
                        'Secteur R13 E2E'
                    )
                    RETURNING id
                    """,
                    [
                        district_id,
                    ],
                )
                sector_id = cursor.fetchone()[0]

                cursor.execute(
                    """
                    INSERT INTO public.agents (
                        id,
                        badge_number,
                        zone_id,
                        active,
                        hired_at
                    )
                    VALUES (
                        %s,
                        'R13-E2E-AGENT-001',
                        %s,
                        TRUE,
                        CURRENT_DATE
                    )
                    """,
                    [
                        agent_id,
                        commune_id,
                    ],
                )

                cursor.execute(
                    """
                    SELECT id
                    FROM public.cms_plans
                    WHERE
                        code =
                            'residentiel_standard'
                        AND fulfillment_kind =
                            'physical_installation'
                    LIMIT 1
                    """
                )

                plan_row = cursor.fetchone()

                self.assertIsNotNone(
                    plan_row
                )

                plan_id = plan_row[0]

                cursor.execute(
                    """
                    INSERT INTO public.orders (
                        customer_id,
                        offer_code,
                        amount_gnf,
                        status,
                        order_ref,
                        items,
                        phone,
                        devis_demande,
                        plan_id
                    )
                    VALUES (
                        %s,
                        'residentiel_standard',
                        150000,
                        'pending',
                        'R13-E2E-ORDER-0001',
                        %s::jsonb,
                        '+224620000001',
                        FALSE,
                        %s
                    )
                    RETURNING id
                    """,
                    [
                        customer_id,
                        json.dumps(items),
                        plan_id,
                    ],
                )
                order_id = cursor.fetchone()[0]

                cursor.execute(
                    """
                    INSERT INTO public.order_sites (
                        order_id,
                        sequence_no,
                        place_type,
                        place_name,
                        requested_location,
                        location_accuracy_m,
                        commune_id,
                        district_id,
                        sector_id,
                        address_line,
                        access_point_note,
                        status
                    )
                    VALUES (
                        %s,
                        1,
                        'other',
                        'Adresse physique R13 E2E',
                        ST_SetSRID(
                            ST_MakePoint(
                                -13.5784,
                                9.6412
                            ),
                            4326
                        )::geography,
                        12.50,
                        %s,
                        %s,
                        %s,
                        'Kaloum R13 E2E',
                        'Portail principal E2E',
                        'pending'
                    )
                    RETURNING id
                    """,
                    [
                        order_id,
                        commune_id,
                        district_id,
                        sector_id,
                    ],
                )
                order_site_id = (
                    cursor.fetchone()[0]
                )

                cursor.execute(
                    """
                    INSERT INTO public.payments (
                        order_id,
                        provider,
                        amount_gnf,
                        status
                    )
                    VALUES (
                        %s,
                        'manual',
                        150000,
                        'pending'
                    )
                    RETURNING id
                    """,
                    [
                        order_id,
                    ],
                )
                payment_id = cursor.fetchone()[0]

        self.assertEqual(
            self.counts()["beacons"],
            0,
        )

        # -------------------------------------------------------------
        # First confirmation
        # -------------------------------------------------------------

        first = confirm_manual_payment_core(
            actor_id=str(actor_id),
            payment_id=str(payment_id),
            external_ref=
                "R13-E2E-PAYMENT-0001",
            note="R13 permanent E2E",
        )

        self.assertTrue(
            first["ok"]
        )

        self.assertFalse(
            first["idempotent"]
        )

        fulfillment = first["fulfillment"]

        self.assertEqual(
            fulfillment["fulfillment_kind"],
            "physical_installation",
        )

        beacon_id = fulfillment["beacon_id"]
        address_id = fulfillment["address_id"]

        pending_id = fulfillment[
            "pending_installation_id"
        ]

        public_number = fulfillment[
            "public_number"
        ]

        UUID(str(beacon_id))
        UUID(str(address_id))
        UUID(str(pending_id))

        counts_after_first = self.counts()

        self.assertEqual(
            counts_after_first["beacons"],
            1,
        )

        self.assertEqual(
            counts_after_first["addresses"],
            1,
        )

        self.assertEqual(
            counts_after_first[
                "pending_installations"
            ],
            1,
        )

        self.assertEqual(
            counts_after_first[
                "installations"
            ],
            0,
        )

        canonical = self.one(
            """
            SELECT
                b.id,
                b.public_number,
                b.national_id,
                b.check_digit,
                b.commune_code_at_issue,
                b.numbering_version,

                a.id,
                a.owner_id,
                a.visibility,
                a.verification_level,
                a.status,
                a.commune_id,
                a.district_id,
                a.sector_id,

                o.beacon_id,
                os.beacon_id,
                pi.beacon_id,
                pi.status

            FROM public.beacons b

            JOIN public.addresses a
              ON a.beacon_id = b.id

            JOIN public.orders o
              ON o.id = %s

            JOIN public.order_sites os
              ON os.order_id = o.id

            JOIN public.pending_installations pi
              ON pi.order_id = o.id

            WHERE b.id = %s
            """,
            [
                order_id,
                beacon_id,
            ],
        )

        self.assertIsNotNone(
            canonical
        )

        (
            db_beacon_id,
            db_public_number,
            national_id,
            check_digit,
            commune_code,
            numbering_version,
            db_address_id,
            owner_id,
            visibility,
            verification_level,
            address_status,
            db_commune_id,
            db_district_id,
            db_sector_id,
            order_beacon_id,
            site_beacon_id,
            pending_beacon_id,
            pending_status,
        ) = canonical

        self.assertEqual(
            national_id,
            FIRST_NATIONAL_ID,
        )

        self.assertEqual(
            commune_code,
            EXPECTED_COMMUNE_CODE,
        )

        self.assertEqual(
            numbering_version,
            "v1",
        )

        self.assertEqual(
            visibility,
            "private",
        )

        self.assertEqual(
            verification_level,
            "pending",
        )

        self.assertEqual(
            address_status,
            "active",
        )

        self.assertEqual(
            str(owner_id),
            str(customer_id),
        )

        self.assertEqual(
            str(db_commune_id),
            str(commune_id),
        )

        self.assertEqual(
            str(db_district_id),
            str(district_id),
        )

        self.assertEqual(
            str(db_sector_id),
            str(sector_id),
        )

        self.assertEqual(
            {
                str(order_beacon_id),
                str(site_beacon_id),
                str(pending_beacon_id),
            },
            {
                str(beacon_id),
            },
        )

        self.assertEqual(
            str(db_beacon_id),
            str(beacon_id),
        )

        self.assertEqual(
            str(db_address_id),
            str(address_id),
        )

        self.assertEqual(
            db_public_number,
            public_number,
        )

        self.assertEqual(
            pending_status,
            "pending",
        )

        self.assertRegex(
            public_number,
            r"^CKY01-58274136[0-9]$",
        )

        self.assertEqual(
            str(check_digit),
            public_number[-1],
        )

        sequence_after_first = self.one(
            """
            SELECT
                last_value,
                is_called
            FROM public.address_national_id_seq
            """
        )

        self.assertEqual(
            sequence_after_first,
            (
                58274136,
                True,
            ),
        )

        # -------------------------------------------------------------
        # Replay
        # -------------------------------------------------------------

        counts_before_replay = self.counts()

        sequence_before_replay = self.one(
            """
            SELECT
                last_value,
                is_called
            FROM public.address_national_id_seq
            """
        )

        replay = confirm_manual_payment_core(
            actor_id=str(actor_id),
            payment_id=str(payment_id),
            external_ref=
                "R13-E2E-PAYMENT-0001",
            note="R13 permanent E2E replay",
        )

        self.assertTrue(
            replay["ok"]
        )

        self.assertTrue(
            replay["idempotent"]
        )

        replay_fulfillment = replay[
            "fulfillment"
        ]

        self.assertEqual(
            str(
                replay_fulfillment[
                    "beacon_id"
                ]
            ),
            str(beacon_id),
        )

        self.assertEqual(
            str(
                replay_fulfillment[
                    "address_id"
                ]
            ),
            str(address_id),
        )

        self.assertEqual(
            str(
                replay_fulfillment[
                    "pending_installation_id"
                ]
            ),
            str(pending_id),
        )

        self.assertEqual(
            replay_fulfillment[
                "public_number"
            ],
            public_number,
        )

        self.assertEqual(
            self.counts(),
            counts_before_replay,
        )

        self.assertEqual(
            self.one(
                """
                SELECT
                    last_value,
                    is_called
                FROM public.address_national_id_seq
                """
            ),
            sequence_before_replay,
        )

        # -------------------------------------------------------------
        # Planning bridge
        # -------------------------------------------------------------

        with transaction.atomic():

            with connection.cursor() as cursor:

                cursor.execute(
                    """
                    UPDATE public.pending_installations
                    SET
                        assigned_agent_id = %s,
                        scheduled_at = NOW(),
                        status = 'planned',
                        updated_at = NOW()
                    WHERE id = %s
                      AND beacon_id = %s
                      AND status = 'pending'
                      AND completed_at IS NULL
                    """,
                    [
                        agent_id,
                        pending_id,
                        beacon_id,
                    ],
                )

                self.assertEqual(
                    cursor.rowcount,
                    1,
                )

        # -------------------------------------------------------------
        # Field complete
        # -------------------------------------------------------------

        field_lat = 9.6423456
        field_lng = -13.5798765
        field_accuracy = 4.25

        counts_before_field = self.counts()

        sequence_before_field = self.one(
            """
            SELECT
                last_value,
                is_called
            FROM public.address_national_id_seq
            """
        )

        field_result = (
            record_physical_installation(
                pending_installation_id=
                    str(pending_id),

                actor_id=
                    str(actor_id),

                agent_id=
                    str(agent_id),

                gps_lat=
                    field_lat,

                gps_lng=
                    field_lng,

                accuracy_m=
                    field_accuracy,

                photo_url=(
                    "https://e2e.local/"
                    "r13-installation.jpg"
                ),
            )
        )

        self.assertTrue(
            field_result["ok"]
        )

        self.assertFalse(
            field_result["idempotent"]
        )

        self.assertEqual(
            str(
                field_result["beacon_id"]
            ),
            str(beacon_id),
        )

        self.assertEqual(
            str(
                field_result["address_id"]
            ),
            str(address_id),
        )

        self.assertEqual(
            field_result["public_number"],
            public_number,
        )

        counts_after_field = self.counts()

        self.assertEqual(
            counts_after_field["beacons"],
            1,
        )

        self.assertEqual(
            counts_after_field["addresses"],
            1,
        )

        self.assertEqual(
            counts_after_field[
                "pending_installations"
            ],
            1,
        )

        self.assertEqual(
            counts_after_field[
                "installations"
            ],
            1,
        )

        self.assertEqual(
            counts_after_field[
                "notifications"
            ],
            counts_before_field[
                "notifications"
            ],
        )

        self.assertEqual(
            self.one(
                """
                SELECT
                    last_value,
                    is_called
                FROM public.address_national_id_seq
                """
            ),
            sequence_before_field,
        )

        # -------------------------------------------------------------
        # Final canonical state
        # -------------------------------------------------------------

        final_state = self.one(
            """
            SELECT
                b.id,
                b.public_number,
                b.national_id,

                a.id,
                ST_X(
                    a.location::geometry
                ),
                ST_Y(
                    a.location::geometry
                ),
                a.accuracy_m,

                o.beacon_id,
                o.status,
                o.installed_at,

                os.beacon_id,
                os.status,

                pi.beacon_id,
                pi.status,

                i.id,
                i.beacon_id,
                i.agent_id,
                i.order_site_id

            FROM public.orders o

            JOIN public.order_sites os
              ON os.order_id = o.id

            JOIN public.pending_installations pi
              ON pi.order_id = o.id

            JOIN public.beacons b
              ON b.id = o.beacon_id

            JOIN public.addresses a
              ON a.beacon_id = b.id

            JOIN public.installations i
              ON i.order_site_id = os.id

            WHERE o.id = %s
            """,
            [
                order_id,
            ],
        )

        self.assertIsNotNone(
            final_state
        )

        (
            final_beacon,
            final_public_number,
            final_national_id,
            final_address,
            final_lng,
            final_lat,
            final_accuracy,
            final_order_beacon,
            final_order_status,
            final_installed_at,
            final_site_beacon,
            final_site_status,
            final_pending_beacon,
            final_pending_status,
            installation_id,
            installation_beacon,
            installation_agent,
            installation_site,
        ) = final_state

        self.assertEqual(
            str(final_beacon),
            str(beacon_id),
        )

        self.assertEqual(
            str(final_address),
            str(address_id),
        )

        self.assertEqual(
            final_public_number,
            public_number,
        )

        self.assertEqual(
            final_national_id,
            FIRST_NATIONAL_ID,
        )

        self.assertEqual(
            str(final_order_beacon),
            str(beacon_id),
        )

        self.assertEqual(
            str(final_site_beacon),
            str(beacon_id),
        )

        self.assertEqual(
            str(final_pending_beacon),
            str(beacon_id),
        )

        self.assertEqual(
            str(installation_beacon),
            str(beacon_id),
        )

        self.assertEqual(
            final_order_status,
            "paid",
        )

        self.assertIsNotNone(
            final_installed_at
        )

        self.assertEqual(
            final_site_status,
            "done",
        )

        self.assertEqual(
            final_pending_status,
            "installed",
        )

        self.assertEqual(
            str(installation_agent),
            str(agent_id),
        )

        self.assertEqual(
            str(installation_site),
            str(order_site_id),
        )

        UUID(
            str(installation_id)
        )

        self.assertAlmostEqual(
            float(final_lat),
            field_lat,
            places=7,
        )

        self.assertAlmostEqual(
            float(final_lng),
            field_lng,
            places=7,
        )

        self.assertAlmostEqual(
            float(final_accuracy),
            field_accuracy,
            places=2,
        )

        # -------------------------------------------------------------
        # Side effects
        # -------------------------------------------------------------

        audit_actions = self.all_rows(
            """
            SELECT
                action,
                entity
            FROM public.audit_logs
            ORDER BY created_at
            """
        )

        self.assertIn(
            (
                "payment.confirm.core",
                "payments",
            ),
            audit_actions,
        )

        self.assertIn(
            (
                "installation.field_complete.v1",
                "installations",
            ),
            audit_actions,
        )

        notification_count = self.one(
            """
            SELECT COUNT(*)
            FROM public.notifications
            WHERE
                user_id = %s
                AND type =
                    'payment_confirmed'
            """,
            [
                customer_id,
            ],
        )[0]

        self.assertEqual(
            int(notification_count),
            1,
        )


if __name__ == "__main__":
    unittest.main(
        verbosity=2
    )
