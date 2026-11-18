"""VIAGO D7-D7-B: eligible SQL provider integration tests.

Entirely offline. Database responses are explicitly simulated.
"""

import unittest

from routing.viago_map_matching_metric_provider import (
    find_metric_road_candidates,
    metric_candidate_sql,
)
from routing.viago_map_matching_eligible_sql import (
    eligible_metric_candidate_sql,
)


def row(edge_id, distance, forward=10.0, reverse=-1.0):
    return (
        edge_id, edge_id, edge_id + 1,
        -13.7, 9.51, 0.5, float(distance),
        forward, reverse, 100.0, 50.0, 50.0,
    )


class Cursor:
    def __init__(self, physical_rows):
        self.physical_rows = physical_rows
        self.sql = None
        self.params = None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, sql, params):
        self.sql = sql
        self.params = list(params)

    def fetchall(self):
        if self.sql is None:
            raise AssertionError("Query not executed")

        # This fake implements the expected eligibility semantics.
        # It does not validate execution on PostgreSQL.
        assert "pv.cost >= 0" in self.sql
        assert "pv.reverse_cost >= 0" in self.sql

        eligible = [
            item for item in self.physical_rows
            if (
                item[7] is not None and item[7] >= 0
            ) or (
                item[8] is not None and item[8] >= 0
            )
        ]

        eligible.sort(key=lambda item: (item[6], item[0]))
        return eligible[:self.params[3]]


class Connection:
    def __init__(self, rows):
        self.cursor_obj = Cursor(rows)

    def cursor(self):
        return self.cursor_obj


class EligibleProviderTests(unittest.TestCase):

    def query(self, rows, profile="car", limit=2):
        conn = Connection(rows)

        result = find_metric_road_candidates(
            longitude=-13.7,
            latitude=9.51,
            profile=profile,
            radius_m=50,
            connection_obj=conn,
            limit=limit,
        )

        return result, conn.cursor_obj

    def test_only_eligible_road_survives(self):
        result, _ = self.query([
            row(201, 2, -1, -1),
            row(202, 4, -1, -1),
            row(203, 7, 10, -1),
        ])

        self.assertEqual(
            [c["edge_id"] for c in result["candidates"]],
            [203],
        )
        self.assertFalse(result["truncated"])

    def test_reverse_only_road_survives(self):
        result, _ = self.query([
            row(301, 3, -1, 10),
        ])

        self.assertEqual(
            [c["edge_id"] for c in result["candidates"]],
            [301],
        )
        self.assertTrue(
            result["candidates"][0]["reverse_enabled"]
        )

    def test_eligible_truncation(self):
        result, _ = self.query([
            row(401, 1),
            row(402, 2),
            row(403, 3),
            row(404, 4),
        ])

        self.assertEqual(
            [c["edge_id"] for c in result["candidates"]],
            [401, 402],
        )
        self.assertTrue(result["truncated"])

    def test_ineligible_edges_do_not_consume_limit(self):
        result, _ = self.query([
            row(501, 1, -1, -1),
            row(502, 2, -1, -1),
            row(503, 3, -1, -1),
            row(504, 4, 10, -1),
            row(505, 5, 10, -1),
        ])

        self.assertEqual(
            [c["edge_id"] for c in result["candidates"]],
            [504, 505],
        )
        self.assertFalse(result["truncated"])

    def test_sql_contract_for_three_profiles(self):
        for profile in ("car", "motorcycle", "foot"):
            with self.subTest(profile=profile):
                _, cursor = self.query(
                    [row(601, 3)],
                    profile=profile,
                )

                self.assertIn(
                    "JOIN maps_routing_stage.routing_edges_"
                    + profile,
                    cursor.sql,
                )

                self.assertIn(
                    "pv.cost >= 0",
                    cursor.sql,
                )
                self.assertEqual(
                    cursor.sql.count("%s"),
                    4,
                )

    def test_parameter_contract(self):
        _, cursor = self.query([row(701, 3)])

        self.assertEqual(
            cursor.params,
            [-13.7, 9.51, 50.0, 3],
        )

    def test_existing_sql_builder_preserved(self):
        legacy = metric_candidate_sql("car")
        eligible = eligible_metric_candidate_sql("car")

        self.assertIn("LEFT JOIN", legacy)
        self.assertIn("JOIN ", eligible)
        self.assertNotEqual(legacy, eligible)

    def test_no_navigation_authorization(self):
        result, _ = self.query([row(801, 3)])

        self.assertIs(result["confirmed"], False)
        self.assertIs(result["navigation_authorized"], False)


if __name__ == "__main__":
    unittest.main()