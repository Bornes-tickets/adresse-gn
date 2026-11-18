"""VIAGO D7-D3 offline SQL/provider contract tests."""

import unittest

from routing.viago_map_matching_candidates import (
    CandidateContractError,
    CandidateValidationError,
)
from routing.viago_map_matching_metric_provider import (
    metric_candidate_sql,
    find_metric_road_candidates,
)


def row(edge=10, length=100, source_m=95, target_m=5):
    return (
        edge, 1, 2, -13.7, 9.51, 0.95, 4.0,
        10.0, -1.0, length, source_m, target_m,
    )


class Cursor:
    def __init__(self, rows):
        self.rows = rows
        self.sql = None
        self.params = None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, sql, params):
        self.sql = sql
        self.params = params

    def fetchall(self):
        return self.rows


class Connection:
    def __init__(self, rows):
        self.last = Cursor(rows)

    def cursor(self):
        return self.last


class MetricProviderTests(unittest.TestCase):

    def query(self, rows, **extra):
        conn = Connection(rows)
        args = dict(
            longitude=-13.7, latitude=9.51,
            profile="car", radius_m=50,
            connection_obj=conn,
        )
        args.update(extra)
        return find_metric_road_candidates(**args), conn.last

    def test_metric_columns_are_returned(self):
        result, _ = self.query([row()])
        item = result["candidates"][0]
        self.assertEqual(item["edge_length_m"], 100)
        self.assertEqual(item["distance_to_target_m"], 5)
        self.assertTrue(item["forward_enabled"])
        self.assertFalse(item["reverse_enabled"])
        self.assertFalse(result["confirmed"])

    def test_sql_uses_geographic_subsegments(self):
        sql = metric_candidate_sql("car")
        self.assertIn("ST_LineSubstring(", sql)
        self.assertIn("::geography", sql)
        self.assertIn("ST_DWithin(", sql)
        self.assertIn("routing_edges_car", sql)
        self.assertEqual(sql.count("%s"), 4)

    def test_three_profiles_are_whitelisted(self):
        for name in ("car", "motorcycle", "foot"):
            self.assertIn(
                "maps_routing_stage.routing_edges_" + name,
                metric_candidate_sql(name),
            )
        with self.assertRaises(CandidateValidationError):
            metric_candidate_sql("unknown")

    def test_parameterized_query(self):
        _, cursor = self.query([row()])
        self.assertEqual(cursor.params, [-13.7, 9.51, 50.0, 17])

    def test_truncation_fails_closed(self):
        rows = [row(edge=i) for i in range(3)]
        result, _ = self.query(rows, limit=2)
        self.assertTrue(result["truncated"])
        self.assertFalse(result["confirmed"])

    def test_missing_metric_rejected(self):
        bad = list(row())
        bad[9] = None
        with self.assertRaises(CandidateContractError):
            self.query([tuple(bad)])

    def test_inconsistent_metrics_rejected(self):
        with self.assertRaises(CandidateContractError):
            self.query([row(length=100, source_m=95, target_m=50)])

    def test_empty_rows_do_not_confirm(self):
        result, _ = self.query([])
        self.assertEqual(result["status"], "no_candidates")
        self.assertFalse(result["navigation_authorized"])


if __name__ == "__main__":
    unittest.main()