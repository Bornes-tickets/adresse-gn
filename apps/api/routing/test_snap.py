from __future__ import annotations

from django.conf import settings


if not settings.configured:
    settings.configure(
        SECRET_KEY="block14-p8e6-unit-only",
        DATABASES={
            "default": {
                "ENGINE": "django.db.backends.dummy",
            }
        },
        USE_TZ=True,
    )


import unittest
from unittest.mock import patch

from routing import snap


class FakeCursor:
    def __init__(self, row):
        self.row = row
        self.sql = None
        self.params = None

    def __enter__(self):
        return self

    def __exit__(
        self,
        exc_type,
        exc,
        traceback,
    ):
        return False

    def execute(
        self,
        sql,
        params,
    ):
        self.sql = sql
        self.params = list(params)

    def fetchone(self):
        return self.row


class FakeConnection:
    def __init__(self, row):
        self.cursor_instance = FakeCursor(row)

    def cursor(self):
        return self.cursor_instance


def make_row(
    *,
    edge_id=100,
    source=10,
    target=20,
    snapped_longitude=-13.5,
    snapped_latitude=9.5,
    fraction=0.25,
    distance_m=4.5,
    expanded_count=65,
    forward_cost=12.0,
    reverse_cost=13.0,
):
    return (
        edge_id,
        source,
        target,
        snapped_longitude,
        snapped_latitude,
        fraction,
        distance_m,
        expanded_count,
        forward_cost,
        reverse_cost,
    )


class SnapServiceUnitTests(unittest.TestCase):
    def call_service(
        self,
        row,
        *,
        profile="car",
        candidate_limit=64,
    ):
        fake_connection = FakeConnection(row)

        with patch.object(
            snap,
            "connection",
            fake_connection,
        ):
            result = snap.snap_point_to_routing_graph(
                longitude=-13.5,
                latitude=9.5,
                profile=profile,
                candidate_limit=candidate_limit,
            )

        return (
            result,
            fake_connection.cursor_instance,
        )

    def test_bidirectional_states_are_exposed(self):
        result, _ = self.call_service(
            make_row(
                edge_id=123,
                forward_cost=10.0,
                reverse_cost=11.0,
            )
        )

        self.assertEqual(
            result["status"],
            "ok",
        )

        self.assertTrue(
            result["forward_enabled"]
        )

        self.assertTrue(
            result["reverse_enabled"]
        )

        self.assertEqual(
            result["forward_state_id"],
            246,
        )

        self.assertEqual(
            result["reverse_state_id"],
            247,
        )

    def test_forward_only_direction(self):
        result, _ = self.call_service(
            make_row(
                edge_id=77,
                forward_cost=6.0,
                reverse_cost=-1.0,
            )
        )

        self.assertTrue(
            result["forward_enabled"]
        )

        self.assertFalse(
            result["reverse_enabled"]
        )

        self.assertEqual(
            result["forward_state_id"],
            154,
        )

        self.assertIsNone(
            result["reverse_state_id"]
        )

    def test_reverse_only_direction(self):
        result, _ = self.call_service(
            make_row(
                edge_id=77,
                forward_cost=-1.0,
                reverse_cost=6.0,
            )
        )

        self.assertFalse(
            result["forward_enabled"]
        )

        self.assertTrue(
            result["reverse_enabled"]
        )

        self.assertIsNone(
            result["forward_state_id"]
        )

        self.assertEqual(
            result["reverse_state_id"],
            155,
        )

    def test_no_routable_direction_is_explicit(self):
        result, cursor = self.call_service(
            make_row(
                edge_id=88,
                forward_cost=None,
                reverse_cost=None,
            ),
            profile="foot",
        )

        self.assertEqual(
            result["status"],
            "no_routable_direction",
        )

        normalized = " ".join(
            cursor.sql.split()
        )

        self.assertIn(
            "LEFT JOIN maps_routing_stage.routing_edges_foot AS pv",
            normalized,
        )

    def test_motorcycle_uses_whitelisted_view(self):
        result, cursor = self.call_service(
            make_row(),
            profile="motorcycle",
        )

        self.assertEqual(
            result["profile"],
            "motorcycle",
        )

        normalized = " ".join(
            cursor.sql.split()
        )

        self.assertIn(
            "LEFT JOIN maps_routing_stage.routing_edges_motorcycle AS pv",
            normalized,
        )

    def test_sql_is_tie_aware_and_physical_first(self):
        result, cursor = self.call_service(
            make_row()
        )

        normalized = " ".join(
            cursor.sql.split()
        )

        lowered = normalized.lower()

        self.assertIn(
            "ORDER BY e.geom <-> p.g LIMIT %s",
            normalized,
        )

        self.assertIn(
            "ST_DWithin( e.geom, p.g, kth.threshold )",
            normalized,
        )

        self.assertIn(
            "ORDER BY distance_m, edge_id LIMIT 1",
            normalized,
        )

        self.assertNotIn(
            "ORDER BY e.geom <-> p.g,",
            normalized,
        )

        self.assertNotIn(
            "pgr_",
            lowered,
        )

        self.assertEqual(
            cursor.params,
            [
                -13.5,
                9.5,
                64,
            ],
        )

        self.assertEqual(
            result["radius_status"],
            "UNQUALIFIED_NO_PRODUCTION_RADIUS",
        )

    def test_invalid_coordinates_are_rejected(self):
        invalid_cases = [
            (float("nan"), 9.5),
            (181.0, 9.5),
            (-13.5, 91.0),
            (True, 9.5),
        ]

        for longitude, latitude in invalid_cases:
            with self.subTest(
                longitude=longitude,
                latitude=latitude,
            ):
                with self.assertRaises(
                    snap.SnapValidationError
                ):
                    snap.snap_point_to_routing_graph(
                        longitude=longitude,
                        latitude=latitude,
                        profile="car",
                        candidate_limit=64,
                    )

    def test_invalid_profile_is_rejected(self):
        with self.assertRaises(
            snap.SnapValidationError
        ):
            snap.snap_point_to_routing_graph(
                longitude=-13.5,
                latitude=9.5,
                profile="bicycle",
                candidate_limit=64,
            )

    def test_invalid_candidate_limit_is_rejected(self):
        for value in (
            0,
            -1,
            64.0,
            True,
        ):
            with self.subTest(
                candidate_limit=value
            ):
                with self.assertRaises(
                    snap.SnapValidationError
                ):
                    snap.snap_point_to_routing_graph(
                        longitude=-13.5,
                        latitude=9.5,
                        profile="car",
                        candidate_limit=value,
                    )

    def test_missing_physical_edge_raises(self):
        fake_connection = FakeConnection(
            None
        )

        with patch.object(
            snap,
            "connection",
            fake_connection,
        ):
            with self.assertRaises(
                snap.SnapNotFoundError
            ):
                snap.snap_point_to_routing_graph(
                    longitude=-13.5,
                    latitude=9.5,
                    profile="car",
                    candidate_limit=64,
                )


if __name__ == "__main__":
    unittest.main()