"""VIAGO D7-B distance guard tests. Offline only."""

import unittest

from routing.test_viago_map_matching_pipeline import sequence
from routing.viago_map_matching_pipeline import assess_matching_pipeline


class DistanceGuardTests(unittest.TestCase):

    def evaluate(self, accuracy, distance):
        samples = sequence(accuracy=accuracy)

        for sample in samples:
            sample["candidates"][0]["distance_m"] = distance

        return assess_matching_pipeline(samples)

    def test_distant_95m_with_gps20_is_insufficient(self):
        result = self.evaluate(20, 95)
        self.assertEqual(result["status"], "insufficient")
        self.assertFalse(result["confirmed"])
        self.assertFalse(result["navigation_authorized"])

    def test_distant_80m_with_gps41_is_insufficient(self):
        result = self.evaluate(41, 80)
        self.assertEqual(result["status"], "insufficient")
        self.assertFalse(result["navigation_authorized"])

    def test_just_outside_uncertainty_is_insufficient(self):
        result = self.evaluate(20, 21)
        self.assertEqual(result["status"], "insufficient")

    def test_within_uncertainty_remains_advisory(self):
        result = self.evaluate(41, 20)
        self.assertEqual(result["status"], "candidate_stable")
        self.assertFalse(result["confirmed"])
        self.assertFalse(result["navigation_authorized"])

    def test_nonfinite_distance_is_invalid(self):
        result = self.evaluate(20, float("nan"))
        self.assertEqual(result["status"], "invalid")

    def test_nonfinite_accuracy_is_invalid(self):
        result = self.evaluate(float("nan"), 5)
        self.assertEqual(result["status"], "invalid")


if __name__ == "__main__":
    unittest.main()