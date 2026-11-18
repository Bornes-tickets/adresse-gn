"""VIAGO D7-D7-A: SQL contract and eligibility simulations."""

import unittest

from routing.viago_map_matching_candidates import (
    CandidateValidationError,
)

from routing.viago_map_matching_eligible_sql import (
    eligible_metric_candidate_sql,
)


def eligible_rows(rows, limit):
    """Illustrative SQL ordering simulation, not PostgreSQL."""
    return sorted(
        [
            row for row in rows
            if row["forward"] >= 0
            or row["reverse"] >= 0
        ],
        key=lambda row: (row["distance"], row["id"]),
    )[: limit + 1]


class EligibleCandidateSQLTests(unittest.TestCase):

    def test_three_profiles(self):
        for profile in ("car", "motorcycle", "foot"):
            with self.subTest(profile=profile):
                sql = eligible_metric_candidate_sql(profile)
                self.assertIn(
                    "maps_routing_stage.routing_edges_" + profile,
                    sql,
                )

    def test_unknown_profile_rejected(self):
        with self.assertRaises(CandidateValidationError):
            eligible_metric_candidate_sql("admin")

    def test_four_bound_parameters(self):
        self.assertEqual(
            eligible_metric_candidate_sql("car").count("%s"),
            4,
        )

    def test_profile_filter_precedes_limit(self):
        sql = eligible_metric_candidate_sql("car")
        self.assertLess(sql.index("JOIN "), sql.index("LIMIT %s"))
        self.assertLess(
            sql.index("pv.cost >= 0"),
            sql.index("LIMIT %s"),
        )
        self.assertLess(
            sql.index("pv.reverse_cost >= 0"),
            sql.index("LIMIT %s"),
        )

    def test_metric_output_contract(self):
        sql = eligible_metric_candidate_sql("car")
        for field in (
            "distance_to_source_m",
            "distance_to_target_m",
            "edge_length_m",
            "ST_LineSubstring(",
            "::geography",
        ):
            self.assertIn(field, sql)

    def test_excluded_nonroutable_edges(self):
        rows = [
            {"id": 201, "distance": 2, "forward": -1, "reverse": -1},
            {"id": 202, "distance": 4, "forward": -1, "reverse": -1},
            {"id": 203, "distance": 7, "forward": 10, "reverse": -1},
        ]
        selected = eligible_rows(rows, 2)
        self.assertEqual(
            [row["id"] for row in selected],
            [203],
        )

    def test_truncation_counts_eligible_edges(self):
        rows = [
            {"id": i, "distance": i, "forward": 10, "reverse": -1}
            for i in range(1, 5)
        ]
        selected = eligible_rows(rows, 2)
        self.assertEqual(len(selected), 3)
        self.assertGreater(len(selected), 2)

    def test_reverse_only_edge_is_eligible(self):
        rows = [
            {"id": 501, "distance": 5, "forward": -1, "reverse": 10},
        ]
        self.assertEqual(
            [row["id"] for row in eligible_rows(rows, 2)],
            [501],
        )


if __name__ == "__main__":
    unittest.main()