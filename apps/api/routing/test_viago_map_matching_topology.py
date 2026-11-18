"""Isolated VIAGO D3 topology tests. No database access."""

import unittest

from routing.viago_map_matching_topology import (
    assess_edge_transition,
    assess_topology_sequence,
)


def edge(
    edge_id,
    source,
    target,
    fraction,
    forward=True,
    reverse=False,
):
    return {
        "edge_id": edge_id,
        "source_node_id": source,
        "target_node_id": target,
        "fraction": fraction,
        "forward_enabled": forward,
        "reverse_enabled": reverse,
    }


class TopologyTests(unittest.TestCase):

    def verdict(self, a, b):
        result = assess_edge_transition(a, b)
        self.assertFalse(result["confirmed"])
        return result["status"]

    def test_same_edge_forward(self):
        self.assertEqual(
            self.verdict(
                edge(10, 1, 2, 0.2),
                edge(10, 1, 2, 0.6),
            ),
            "topology_plausible",
        )

    def test_same_edge_reverse_allowed(self):
        self.assertEqual(
            self.verdict(
                edge(10, 1, 2, 0.8, True, True),
                edge(10, 1, 2, 0.3, True, True),
            ),
            "topology_plausible",
        )

    def test_wrong_way_rejected(self):
        self.assertEqual(
            self.verdict(
                edge(10, 1, 2, 0.8),
                edge(10, 1, 2, 0.2),
            ),
            "disconnected",
        )

    def test_connected_junction(self):
        self.assertEqual(
            self.verdict(
                edge(10, 1, 2, 0.95),
                edge(11, 2, 3, 0.05),
            ),
            "topology_plausible",
        )

    def test_disconnected_roads(self):
        self.assertEqual(
            self.verdict(
                edge(10, 1, 2, 0.95),
                edge(20, 8, 9, 0.05),
            ),
            "disconnected",
        )

    def test_parallel_nonconnected_roads(self):
        self.assertEqual(
            self.verdict(
                edge(10, 1, 2, 0.95),
                edge(20, 3, 4, 0.05),
            ),
            "disconnected",
        )

    def test_mid_edge_teleport_rejected(self):
        self.assertEqual(
            self.verdict(
                edge(10, 1, 2, 0.50),
                edge(11, 2, 3, 0.50),
            ),
            "disconnected",
        )

    def test_reverse_exit_to_forward_entry(self):
        self.assertEqual(
            self.verdict(
                edge(10, 1, 2, 0.05, True, True),
                edge(11, 1, 3, 0.05),
            ),
            "topology_plausible",
        )

    def test_forbidden_entry_direction(self):
        self.assertEqual(
            self.verdict(
                edge(10, 1, 2, 0.95),
                edge(11, 3, 2, 0.95),
            ),
            "disconnected",
        )

    def test_stationary_same_edge_ambiguous(self):
        self.assertEqual(
            self.verdict(
                edge(10, 1, 2, 0.5, True, True),
                edge(10, 1, 2, 0.5, True, True),
            ),
            "ambiguous",
        )

    def test_invalid_fraction(self):
        self.assertEqual(
            self.verdict(
                edge(10, 1, 2, 0.9),
                edge(11, 2, 3, 1.5),
            ),
            "invalid",
        )

    def test_connected_sequence_never_confirms(self):
        result = assess_topology_sequence([
            edge(10, 1, 2, 0.5),
            edge(10, 1, 2, 0.95),
            edge(11, 2, 3, 0.05),
            edge(11, 2, 3, 0.5),
        ])

        self.assertEqual(
            result["status"],
            "topology_plausible",
        )
        self.assertFalse(result["confirmed"])


if __name__ == "__main__":
    unittest.main()