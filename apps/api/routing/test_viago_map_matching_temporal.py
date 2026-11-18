"""D2 pure temporal tests: no database or Android access."""

import unittest

from routing.viago_map_matching_temporal import (
    assess_temporal_candidates,
)


def sequence(
    accuracy=20,
    speed=8,
    step=0.0003,
    parallel=False,
    truncate=False,
    change_edge=False,
):
    data = []

    for i in range(5):
        candidates = [{
            "edge_id": 101 if not change_edge or i < 3 else 202,
            "distance_m": 3,
            "routable": True,
        }]

        if parallel:
            candidates.append({
                "edge_id": 202,
                "distance_m": 20,
                "routable": True,
            })

        data.append({
            "at_ms": 1700000000000 + i * 4000,
            "lat": 9.5100,
            "lng": -13.7095 + i * step,
            "accuracy_m": accuracy,
            "speed_mps": speed,
            "truncated": truncate,
            "candidates": candidates,
        })

    return data


class TemporalCandidateTests(unittest.TestCase):
    def test_stable_candidate_never_confirmed(self):
        result = assess_temporal_candidates(sequence())
        self.assertEqual(result["status"], "candidate_stable")
        self.assertEqual(result["edge_id"], 101)
        self.assertFalse(result["confirmed"])

    def test_parallel_road_41m_is_ambiguous(self):
        result = assess_temporal_candidates(
            sequence(accuracy=41, parallel=True)
        )
        self.assertEqual(result["status"], "ambiguous")
        self.assertFalse(result["confirmed"])

    def test_stationary_is_not_progress(self):
        result = assess_temporal_candidates(
            sequence(speed=0, step=0)
        )
        self.assertEqual(result["status"], "insufficient")

    def test_missing_speed_is_not_progress(self):
        result = assess_temporal_candidates(
            sequence(speed=None)
        )
        self.assertEqual(result["status"], "insufficient")

    def test_weak_gps_is_not_progress(self):
        result = assess_temporal_candidates(
            sequence(accuracy=60)
        )
        self.assertEqual(result["status"], "insufficient")

    def test_truncation_is_ambiguous(self):
        result = assess_temporal_candidates(
            sequence(truncate=True)
        )
        self.assertEqual(result["status"], "ambiguous")

    def test_edge_transition_is_ambiguous(self):
        result = assess_temporal_candidates(
            sequence(change_edge=True)
        )
        self.assertEqual(result["status"], "ambiguous")

    def test_single_sample_is_insufficient(self):
        result = assess_temporal_candidates(sequence()[:1])
        self.assertEqual(result["status"], "insufficient")

    def test_timestamp_reversal_is_insufficient(self):
        samples = sequence()
        samples[2]["at_ms"] = samples[1]["at_ms"] - 1000
        result = assess_temporal_candidates(samples)
        self.assertEqual(result["status"], "insufficient")

    def test_impossible_jump_is_rejected(self):
        samples = sequence()
        samples[2]["lng"] = -13.6000
        result = assess_temporal_candidates(samples)
        self.assertEqual(result["status"], "invalid")

    def test_41m_single_candidate_not_confirmed(self):
        result = assess_temporal_candidates(
            sequence(accuracy=41)
        )
        self.assertEqual(result["status"], "candidate_stable")
        self.assertFalse(result["confirmed"])


if __name__ == "__main__":
    unittest.main()