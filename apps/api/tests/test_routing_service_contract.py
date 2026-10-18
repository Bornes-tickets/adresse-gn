from __future__ import annotations

import math
import unittest
from unittest.mock import patch

from routing import services


class FakeCursor:
    def __init__(self, row):
        self.row = row
        self.executed_sql = None
        self.executed_params = None

    def __enter__(self):
        return self

    def __exit__(
        self,
        exc_type,
        exc_value,
        traceback,
    ):
        return False

    def execute(
        self,
        sql,
        params,
    ):
        self.executed_sql = sql
        self.executed_params = params

    def fetchone(self):
        return self.row


class FakeConnection:
    def __init__(self, cursor):
        self.fake_cursor = cursor
        self.cursor_calls = 0

    def cursor(self):
        self.cursor_calls += 1
        return self.fake_cursor


class FakeConnections:
    def __init__(self, mapping):
        self.mapping = mapping
        self.databases = {
            name: {}
            for name in mapping
        }

    def __getitem__(self, alias):
        return self.mapping[alias]


class RoutingServiceContractTests(
    unittest.TestCase
):
    def test_start_equals_end_short_circuits_database(self):
        fake_connections = FakeConnections({})

        with patch.object(
            services,
            "connections",
            fake_connections,
        ):
            result = services.route_state_to_state(
                start_state_id=417992,
                end_state_id=417992,
            )

        self.assertEqual(
            result,
            {
                "reachable": True,
                "total_cost": 0.0,
                "start_state_id": 417992,
                "end_state_id": 417992,
            },
        )

    def test_missing_routing_alias_is_explicit(self):
        fake_connections = FakeConnections({})

        with patch.object(
            services,
            "connections",
            fake_connections,
        ):
            with self.assertRaises(
                services.RoutingBackendNotConfigured
            ):
                services.route_state_to_state(
                    start_state_id=417992,
                    end_state_id=398405,
                )

    def test_pair2_style_reachable_result(self):
        cursor = FakeCursor(
            (
                711.0470099089517,
                20,
            )
        )

        connection = FakeConnection(
            cursor
        )

        fake_connections = FakeConnections(
            {
                "routing": connection,
            }
        )

        with patch.object(
            services,
            "connections",
            fake_connections,
        ):
            result = services.route_state_to_state(
                start_state_id=417992,
                end_state_id=398405,
            )

        self.assertTrue(
            result["reachable"]
        )

        self.assertEqual(
            result["total_cost"],
            711.0470099089517,
        )

        self.assertEqual(
            connection.cursor_calls,
            1,
        )

        self.assertIn(
            "pgr_dijkstra",
            cursor.executed_sql,
        )

        self.assertIn(
            "true",
            cursor.executed_sql,
        )

        self.assertEqual(
            cursor.executed_params[0],
            services.CAR_TRANSITION_EDGE_SQL,
        )

        self.assertEqual(
            cursor.executed_params[1],
            (
                "SELECT "
                "417992::bigint AS source, "
                "398405::bigint AS target"
            ),
        )

    def test_zero_result_rows_means_unreachable(self):
        cursor = FakeCursor(
            (
                None,
                0,
            )
        )

        fake_connections = FakeConnections(
            {
                "routing": FakeConnection(
                    cursor
                ),
            }
        )

        with patch.object(
            services,
            "connections",
            fake_connections,
        ):
            result = services.route_state_to_state(
                start_state_id=1030028,
                end_state_id=2,
            )

        self.assertEqual(
            result,
            {
                "reachable": False,
                "total_cost": None,
                "start_state_id": 1030028,
                "end_state_id": 2,
            },
        )

    def test_non_finite_cost_is_rejected(self):
        for invalid_cost in (
            math.inf,
            -math.inf,
            math.nan,
        ):
            with self.subTest(
                invalid_cost=invalid_cost
            ):
                cursor = FakeCursor(
                    (
                        invalid_cost,
                        1,
                    )
                )

                fake_connections = FakeConnections(
                    {
                        "routing":
                            FakeConnection(
                                cursor
                            ),
                    }
                )

                with patch.object(
                    services,
                    "connections",
                    fake_connections,
                ):
                    with self.assertRaises(
                        services.RoutingBackendError
                    ):
                        services.route_state_to_state(
                            start_state_id=1,
                            end_state_id=2,
                        )

    def test_negative_cost_is_rejected(self):
        cursor = FakeCursor(
            (
                -1.0,
                1,
            )
        )

        fake_connections = FakeConnections(
            {
                "routing":
                    FakeConnection(
                        cursor
                    ),
            }
        )

        with patch.object(
            services,
            "connections",
            fake_connections,
        ):
            with self.assertRaises(
                services.RoutingBackendError
            ):
                services.route_state_to_state(
                    start_state_id=1,
                    end_state_id=2,
                )

    def test_invalid_state_ids_are_rejected(self):
        invalid_values = (
            -1,
            True,
            False,
            1.5,
            "417992",
            None,
        )

        for value in invalid_values:
            with self.subTest(
                value=value
            ):
                with self.assertRaises(
                    ValueError
                ):
                    services.route_state_to_state(
                        start_state_id=value,
                        end_state_id=2,
                    )


if __name__ == "__main__":
    unittest.main()