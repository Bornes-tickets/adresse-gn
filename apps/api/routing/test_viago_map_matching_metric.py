"""VIAGO D7-C metric junction tests: no DB, no API."""

import unittest

from routing.viago_map_matching_topology import (
    assess_metric_edge_transition,
)


def edge(
    eid, source, target, fraction, length,
    forward=True, reverse=False,
):
    return {
        "edge_id": eid,
        "source_node_id": source,
        "target_node_id": target,
        "fraction": fraction,
        "edge_length_m": length,
        "forward_enabled": forward,
        "reverse_enabled": reverse,
    }


class MetricJunctionTests(unittest.TestCase):
    def verify(self, first, second, expected):
        result = assess_metric_edge_transition(first, second)
        self.assertEqual(result["status"], expected)
        self.assertIs(result["confirmed"], False)
        self.assertIs(result["navigation_authorized"], False)

    def test_short_segments_near_junction(self):
        self.verify(
            edge(10, 1, 2, .95, 100),
            edge(11, 2, 3, .05, 100),
            "metric_plausible",
        )

    def test_long_segments_five_percent_is_too_far(self):
        self.verify(
            edge(10, 1, 2, .95, 2000),
            edge(11, 2, 3, .05, 2000),
            "metric_disconnected",
        )

    def test_missing_length_fails_closed(self):
        first = edge(10, 1, 2, .95, 100)
        second = edge(11, 2, 3, .05, 100)
        del first["edge_length_m"]
        self.verify(first, second, "metric_unverified")

    def test_nonfinite_length_rejected(self):
        self.verify(
            edge(10, 1, 2, .95, float("nan")),
            edge(11, 2, 3, .05, 100),
            "invalid",
        )

    def test_zero_length_rejected(self):
        self.verify(
            edge(10, 1, 2, .95, 0),
            edge(11, 2, 3, .05, 100),
            "invalid",
        )

    def test_disconnected_roads(self):
        self.verify(
            edge(10, 1, 2, .95, 100),
            edge(20, 8, 9, .05, 100),
            "disconnected",
        )

    def test_reverse_to_forward_junction(self):
        self.verify(
            edge(10, 1, 2, .05, 100, True, True),
            edge(11, 1, 3, .05, 100),
            "metric_plausible",
        )

    def test_wrong_way_rejected(self):
        self.verify(
            edge(10, 1, 2, .95, 100),
            edge(11, 3, 2, .95, 100),
            "disconnected",
        )

    def test_same_edge_forward_is_only_advisory(self):
        self.verify(
            edge(10, 1, 2, .20, 100),
            edge(10, 1, 2, .60, 100),
            "metric_plausible",
        )


if __name__ == "__main__":
    unittest.main()