"""VIAGO D7-D2 integration tests; no database connection."""

import unittest

from routing.test_viago_map_matching_pipeline import (
    sequence,
    candidate,
)
from routing.viago_map_matching_metric_pipeline import (
    assess_metric_matching_pipeline,
)


def add_metrics(samples, length=100):
    for sample in samples:
        for item in sample["candidates"]:
            fraction = item["fraction"]
            item["edge_length_m"] = length
            item["distance_to_source_m"] = fraction * length
            item["distance_to_target_m"] = (
                1 - fraction
            ) * length
    return samples


def junction(length=100):
    samples = sequence()
    fractions = [0.50, 0.80, 0.95, 0.05, 0.30]

    for i, sample in enumerate(samples):
        if i < 3:
            item = candidate(fraction=fractions[i])
        else:
            item = candidate(
                edge_id=102,
                source=2,
                target=3,
                fraction=fractions[i],
            )

        sample["candidates"] = [item]

    return add_metrics(samples, length)


class MetricPipelineTests(unittest.TestCase):

    def verify(self, samples, expected):
        result = assess_metric_matching_pipeline(samples)
        self.assertEqual(result["status"], expected)
        self.assertIs(result["confirmed"], False)
        self.assertIs(result["navigation_authorized"], False)
        return result

    def test_stable_route_with_metrics_is_advisory(self):
        self.verify(
            add_metrics(sequence()),
            "metric_candidate_stable",
        )

    def test_missing_metrics_fail_closed(self):
        self.verify(
            sequence(),
            "metric_unverified",
        )

    def test_valid_junction_is_metric_plausible(self):
        self.verify(
            junction(),
            "metric_transition_plausible",
        )

    def test_long_edge_junction_is_rejected(self):
        self.verify(
            junction(2000),
            "ambiguous",
        )

    def test_missing_junction_metric_is_unverified(self):
        samples = junction()
        del samples[3]["candidates"][0][
            "distance_to_source_m"
        ]
        self.verify(samples, "metric_unverified")

    def test_inconsistent_total_is_invalid(self):
        samples = add_metrics(sequence())
        samples[2]["candidates"][0][
            "edge_length_m"
        ] = 20
        self.verify(samples, "invalid")

    def test_nonfinite_metric_is_invalid(self):
        samples = add_metrics(sequence())
        samples[2]["candidates"][0][
            "distance_to_target_m"
        ] = float("nan")
        self.verify(samples, "invalid")

    def test_parallel_41m_stays_ambiguous(self):
        samples = sequence(accuracy=41, parallel=True)
        add_metrics(samples)
        self.verify(samples, "ambiguous")

    def test_truncated_stays_ambiguous(self):
        samples = add_metrics(sequence(truncated=True))
        self.verify(samples, "ambiguous")

    def test_distant_road_remains_insufficient(self):
        samples = add_metrics(sequence(accuracy=20))
        for sample in samples:
            sample["candidates"][0]["distance_m"] = 95
        self.verify(samples, "insufficient")

    def test_wrong_way_stays_ambiguous(self):
        samples = add_metrics(sequence())
        for i, sample in enumerate(samples):
            item = sample["candidates"][0]
            item["fraction"] = 0.8 - 0.12 * i
            item["distance_to_source_m"] = (
                item["fraction"] * 100
            )
            item["distance_to_target_m"] = (
                (1 - item["fraction"]) * 100
            )
        self.verify(samples, "ambiguous")


if __name__ == "__main__":
    unittest.main()