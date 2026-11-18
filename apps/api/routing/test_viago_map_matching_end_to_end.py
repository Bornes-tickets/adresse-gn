"""VIAGO D7-D4: provider -> metric pipeline offline integration.

A fake cursor simulates PostGIS rows.
No database connection, network, Android, or navigation actions.
"""

import unittest

from routing.test_viago_map_matching_pipeline import sequence
from routing.test_viago_map_matching_metric_pipeline import junction

from routing.viago_map_matching_candidates import CandidateContractError

from routing.viago_map_matching_metric_provider import (
    find_metric_road_candidates,
)

from routing.viago_map_matching_metric_pipeline import (
    assess_metric_matching_pipeline,
)


def db_row(candidate, length=100):
    fraction = candidate["fraction"]

    return (
        candidate["edge_id"],
        candidate["source_node_id"],
        candidate["target_node_id"],
        -13.7,
        9.51,
        fraction,
        candidate["distance_m"],
        10.0 if candidate["forward_enabled"] else -1.0,
        10.0 if candidate["reverse_enabled"] else -1.0,
        float(length),
        fraction * length,
        (1.0 - fraction) * length,
    )


class FakeCursor:
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
        self.params = list(params)

    def fetchall(self):
        return self.rows


class FakeConnection:
    def __init__(self, rows):
        self.cursor_instance = FakeCursor(rows)

    def cursor(self):
        return self.cursor_instance


def assemble(samples, length=100, radius=100, limit=16):
    """Use the real provider on synthetic database rows."""

    observations = []

    for sample in samples:
        rows = [
            db_row(item, length)
            for item in sample["candidates"]
        ]

        connection = FakeConnection(rows)

        provider = find_metric_road_candidates(
            longitude=sample["lng"],
            latitude=sample["lat"],
            profile="car",
            radius_m=radius,
            connection_obj=connection,
            limit=limit,
        )

        assert connection.cursor_instance.params == [
            sample["lng"],
            sample["lat"],
            float(radius),
            limit + 1,
        ]

        assert provider["confirmed"] is False
        assert provider["navigation_authorized"] is False

        observations.append({
            **sample,
            "candidates": provider["candidates"],
            "truncated": provider["truncated"],
        })

    return observations


class ProviderPipelineE2ETests(unittest.TestCase):

    def verdict(self, samples, expected, **kwargs):
        observations = assemble(samples, **kwargs)

        result = assess_metric_matching_pipeline(
            observations
        )

        self.assertEqual(result["status"], expected)
        self.assertIs(result["confirmed"], False)
        self.assertIs(result["navigation_authorized"], False)

    def test_stable_route_remains_advisory(self):
        self.verdict(
            sequence(),
            "metric_candidate_stable",
        )

    def test_connected_junction_near_endpoints(self):
        self.verdict(
            junction(),
            "metric_transition_plausible",
        )

    def test_long_junction_not_accepted(self):
        self.verdict(
            junction(),
            "ambiguous",
            length=2000,
        )

    def test_parallel_roads_gps_41m(self):
        self.verdict(
            sequence(accuracy=41, parallel=True),
            "ambiguous",
        )

    def test_parallel_roads_gps_20m(self):
        self.verdict(
            sequence(accuracy=20, parallel=True),
            "ambiguous",
        )

    def test_truncated_search_stays_ambiguous(self):
        self.verdict(
            sequence(accuracy=41, parallel=True),
            "ambiguous",
            limit=1,
        )

    def test_distant_candidate_is_insufficient(self):
        samples = sequence(accuracy=20)

        for sample in samples:
            sample["candidates"][0]["distance_m"] = 95

        self.verdict(
            samples,
            "insufficient",
        )

    def test_missing_candidates(self):
        samples = sequence()
        samples[2]["candidates"] = []

        self.verdict(
            samples,
            "no_candidates",
        )

    def test_non_routable_road(self):
        samples = sequence()

        for sample in samples:
            item = sample["candidates"][0]
            item["forward_enabled"] = False
            item["reverse_enabled"] = False
            item["routable"] = False

        self.verdict(
            samples,
            "no_candidates",
        )

    def test_corrupt_metric_row_is_rejected(self):
        candidate = sequence()[0]["candidates"][0]
        bad = list(db_row(candidate))

        # Deliberately violate total road length.
        bad[10] = 500.0

        connection = FakeConnection([tuple(bad)])

        with self.assertRaises(CandidateContractError):
            find_metric_road_candidates(
                longitude=-13.7,
                latitude=9.51,
                profile="car",
                radius_m=100,
                connection_obj=connection,
            )


if __name__ == "__main__":
    unittest.main()