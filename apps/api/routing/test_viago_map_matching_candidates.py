"""Pure unit tests; never connect to a real database."""

import unittest

from routing.viago_map_matching_candidates import (
    CandidateValidationError,
    assess_candidate_ambiguity,
    find_road_candidates,
)


def row(edge, distance):
    return (
        edge, edge * 10, edge * 10 + 1,
        -13.7, 9.51, 0.4, distance, 10.0, 10.0
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
        self.params = params

    def fetchall(self):
        return self.rows


class FakeConnection:
    def __init__(self, rows):
        self.last_cursor = FakeCursor(rows)

    def cursor(self):
        return self.last_cursor


class CandidateTests(unittest.TestCase):
    def query(self, rows, **kwargs):
        connection = FakeConnection(rows)
        result = find_road_candidates(
            longitude=-13.7,
            latitude=9.51,
            profile="car",
            radius_m=50,
            connection_obj=connection,
            **kwargs,
        )
        return result, connection.last_cursor

    def test_two_parallel_roads_are_ambiguous(self):
        result, _ = self.query([row(1, 0), row(2, 20)])
        verdict = assess_candidate_ambiguity(
            result["candidates"], 41,
            truncated=result["truncated"],
        )
        self.assertEqual(verdict, "ambiguous")
        self.assertFalse(result["confirmed"])

    def test_one_candidate_is_not_confirmed(self):
        result, _ = self.query([row(1, 3)])
        self.assertEqual(
            assess_candidate_ambiguity(result["candidates"], 12),
            "unconfirmed",
        )
        self.assertFalse(result["confirmed"])

    def test_empty_candidates(self):
        result, _ = self.query([])
        self.assertEqual(result["status"], "no_candidates")

    def test_truncated_candidates_fail_closed(self):
        result, _ = self.query(
            [row(1, 2), row(2, 10), row(3, 25)],
            limit=2,
        )
        self.assertTrue(result["truncated"])
        self.assertEqual(
            assess_candidate_ambiguity(
                result["candidates"], 5,
                truncated=result["truncated"],
            ),
            "ambiguous",
        )

    def test_profile_is_whitelisted(self):
        connection = FakeConnection([])
        with self.assertRaises(CandidateValidationError):
            find_road_candidates(
                longitude=-13.7,
                latitude=9.51,
                profile="invalid",
                radius_m=50,
                connection_obj=connection,
            )

    def test_sql_is_parameterized_and_profile_scoped(self):
        _, cursor = self.query([row(1, 5)])
        self.assertEqual(cursor.params, [-13.7, 9.51, 50, 17])
        self.assertIn("routing_edges_car", cursor.sql)
        self.assertIn("ST_DWithin", cursor.sql)
        self.assertIn("LIMIT %s", cursor.sql)

    def test_missing_native_direction_is_not_routable(self):
        invalid = (
            1, 10, 11, -13.7, 9.51, 0.4, 5, -1, -1
        )
        result, _ = self.query([invalid])
        self.assertFalse(result["candidates"][0]["routable"])
        self.assertEqual(
            assess_candidate_ambiguity(result["candidates"], 12),
            "no_candidates",
        )


if __name__ == "__main__":
    unittest.main()