"""VIAGO D4 integration tests: offline and fail-closed."""

import unittest

from routing.viago_map_matching_pipeline import (
    assess_matching_pipeline,
)


def candidate(
    edge_id=101,
    source=1,
    target=2,
    fraction=0.2,
    distance=3.0,
    forward=True,
    reverse=False,
):
    return {
        "edge_id": edge_id,
        "source_node_id": source,
        "target_node_id": target,
        "fraction": fraction,
        "distance_m": distance,
        "forward_enabled": forward,
        "reverse_enabled": reverse,
        "routable": forward or reverse,
    }


def sequence(
    accuracy=20,
    speed=8,
    movement=True,
    parallel=False,
    truncated=False,
):
    result = []

    for i in range(5):
        primary = candidate(fraction=0.2 + i * 0.12)
        candidates = [primary]

        if parallel:
            candidates.append(
                candidate(
                    edge_id=202,
                    source=3,
                    target=4,
                    fraction=0.2 + i * 0.12,
                    distance=20,
                )
            )

        result.append({
            "at_ms": 1700000000000 + i * 4000,
            "lat": 9.51,
            "lng": -13.7095 + (i * 0.0003 if movement else 0),
            "accuracy_m": accuracy,
            "speed_mps": speed,
            "truncated": truncated,
            "candidates": candidates,
        })

    return result


class PipelineTests(unittest.TestCase):

    def assess(self, samples, expected):
        result = assess_matching_pipeline(samples)

        self.assertEqual(result["status"], expected)
        self.assertFalse(result["confirmed"])
        self.assertFalse(result["navigation_authorized"])

        return result

    def test_stable_candidate_is_advisory(self):
        result = self.assess(
            sequence(), "candidate_stable"
        )
        self.assertEqual(result["edge_id"], 101)

    def test_parallel_roads_41m_are_ambiguous(self):
        self.assess(
            sequence(accuracy=41, parallel=True),
            "ambiguous",
        )

    def test_parallel_roads_20m_are_ambiguous(self):
        self.assess(
            sequence(accuracy=20, parallel=True),
            "ambiguous",
        )

    def test_stationary_is_not_accepted(self):
        self.assess(
            sequence(speed=0, movement=False),
            "insufficient",
        )

    def test_missing_speed_is_not_accepted(self):
        self.assess(
            sequence(speed=None),
            "insufficient",
        )

    def test_weak_gps_is_insufficient(self):
        self.assess(
            sequence(accuracy=60),
            "insufficient",
        )

    def test_truncated_candidates_are_ambiguous(self):
        self.assess(
            sequence(truncated=True),
            "ambiguous",
        )

    def test_missing_candidates(self):
        samples = sequence()
        samples[2]["candidates"] = []

        self.assess(samples, "no_candidates")

    def test_wrong_way_is_not_accepted(self):
        samples = sequence()

        for i, sample in enumerate(samples):
            sample["candidates"][0]["fraction"] = (
                0.8 - i * 0.12
            )

        self.assess(samples, "ambiguous")

    def test_disconnected_transition(self):
        samples = sequence()

        for i in range(3, 5):
            samples[i]["candidates"] = [
                candidate(
                    edge_id=202,
                    source=8,
                    target=9,
                    fraction=0.1 + (i - 3) * 0.15,
                )
            ]

        self.assess(samples, "ambiguous")

    def test_connected_transition_is_only_plausible(self):
        samples = sequence()

        fractions = [0.50, 0.80, 0.95, 0.05, 0.30]

        for i, sample in enumerate(samples):
            if i < 3:
                sample["candidates"] = [
                    candidate(fraction=fractions[i])
                ]
            else:
                sample["candidates"] = [
                    candidate(
                        edge_id=102,
                        source=2,
                        target=3,
                        fraction=fractions[i],
                    )
                ]

        self.assess(samples, "topology_possible")

    def test_timestamp_reversal(self):
        samples = sequence()
        samples[2]["at_ms"] = samples[1]["at_ms"] - 1000

        self.assess(samples, "insufficient")

    def test_impossible_gps_jump(self):
        samples = sequence()
        samples[2]["lng"] = -13.6000

        self.assess(samples, "invalid")

    def test_no_routable_direction(self):
        samples = sequence()

        for sample in samples:
            sample["candidates"][0]["routable"] = False

        self.assess(samples, "no_candidates")

    def test_single_observation(self):
        self.assess(
            sequence()[:1], "insufficient"
        )


if __name__ == "__main__":
    unittest.main()