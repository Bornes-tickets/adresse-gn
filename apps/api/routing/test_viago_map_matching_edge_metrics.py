"""VIAGO D7-D1: pure tests, without PostGIS connection."""

import unittest

from routing.viago_map_matching_edge_metrics import (
    metric_projection_sql,
    assess_exact_metric_transition,
)


def edge(eid, source, target, fraction, from_source, to_target):
    return {
        "edge_id": eid,
        "source_node_id": source,
        "target_node_id": target,
        "fraction": fraction,
        "forward_enabled": True,
        "reverse_enabled": False,
        "edge_length_m": from_source + to_target,
        "distance_to_source_m": from_source,
        "distance_to_target_m": to_target,
    }


class EdgeMetricsTests(unittest.TestCase):
    def assert_status(self, previous, current, expected):
        result = assess_exact_metric_transition(previous, current)
        self.assertEqual(result["status"], expected)
        self.assertIs(result["confirmed"], False)
        self.assertIs(result["navigation_authorized"], False)

    def test_sql_uses_subline_geography_lengths(self):
        sql = metric_projection_sql()
        self.assertIn("ST_LineSubstring(", sql)
        self.assertIn("ST_Length(", sql)
        self.assertIn("::geography", sql)
        self.assertIn("distance_to_source_m", sql)
        self.assertIn("distance_to_target_m", sql)

    def test_near_junction(self):
        self.assert_status(
            edge(10, 1, 2, .95, 95, 5),
            edge(11, 2, 3, .05, 5, 95),
            "metric_plausible",
        )

    def test_long_road_far_from_junction(self):
        self.assert_status(
            edge(10, 1, 2, .95, 1900, 100),
            edge(11, 2, 3, .05, 100, 1900),
            "metric_disconnected",
        )

    def test_missing_metric(self):
        a = edge(10, 1, 2, .95, 95, 5)
        b = edge(11, 2, 3, .05, 5, 95)
        del b["distance_to_target_m"]
        self.assert_status(a, b, "metric_unverified")

    def test_inconsistent_total_length(self):
        a = edge(10, 1, 2, .95, 95, 5)
        b = edge(11, 2, 3, .05, 5, 95)
        b["edge_length_m"] = 50
        self.assert_status(a, b, "invalid")

    def test_disconnected_graph(self):
        self.assert_status(
            edge(10, 1, 2, .95, 95, 5),
            edge(20, 8, 9, .05, 5, 95),
            "disconnected",
        )

    def test_same_edge_remains_unverified(self):
        self.assert_status(
            edge(10, 1, 2, .2, 20, 80),
            edge(10, 1, 2, .6, 60, 40),
            "metric_unverified",
        )

    def test_zero_length_is_invalid(self):
        self.assert_status(
            edge(10, 1, 2, .95, 0, 0),
            edge(11, 2, 3, .05, 5, 95),
            "invalid",
        )


if __name__ == "__main__":
    unittest.main()