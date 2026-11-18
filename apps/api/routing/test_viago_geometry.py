from __future__ import annotations

import unittest
from unittest.mock import patch

from routing.viago_geometry import ViagoGeometryUnavailable, make_viago_route


def snap(profile="motorcycle", edge=20, fraction=0.25):
    return {"status": "ok", "profile": profile, "edge_id": edge,
            "snapped_longitude": -13.58, "snapped_latitude": 9.64,
            "fraction": fraction}


class ViagoGeometryContractTests(unittest.TestCase):
    def test_no_route_never_draws_a_straight_line(self):
        selection = {"status": "no_route", "start_snap": snap(),
                     "end_snap": snap(edge=21), "selected_candidate": None}
        with patch("routing.viago_geometry.compose_gps_route", return_value=selection):
            result = make_viago_route(start_longitude=-13.58, start_latitude=9.64,
                                      end_longitude=-13.57, end_latitude=9.65,
                                      profile="motorcycle")
        self.assertIsNone(result["geometry"])
        self.assertEqual(result["status"], "no_route")

    def test_direct_segment_uses_selected_direction_and_profile(self):
        selection = {"status": "ok", "start_snap": snap(edge=20, fraction=0.2),
                     "end_snap": snap(edge=20, fraction=0.8),
                     "selected_candidate": {"kind": "same_edge_direct",
                                            "direction": "forward", "total_cost": 6}}
        with patch("routing.viago_geometry.compose_gps_route", return_value=selection), \
             patch("routing.viago_geometry._line_for_state",
                   return_value=([[-13.58, 9.64], [-13.57, 9.64]], 100)) as line:
            result = make_viago_route(start_longitude=-13.58, start_latitude=9.64,
                                      end_longitude=-13.57, end_latitude=9.64,
                                      profile="motorcycle")
        self.assertEqual(result["distance_m"], 100)
        line.assert_called_once()
        self.assertEqual(line.call_args.kwargs["profile"], "motorcycle")
        self.assertEqual(line.call_args.kwargs["state_id"], 40)

    def test_disconnected_network_is_rejected(self):
        selection = {"status": "ok", "start_snap": snap(edge=20, fraction=0.2),
                     "end_snap": snap(edge=21, fraction=0.8),
                     "selected_candidate": {"kind": "network", "start_state_id": 40,
                                            "end_state_id": 42, "total_cost": 8,
                                            "pg_cost": 6}}
        with patch("routing.viago_geometry.compose_gps_route", return_value=selection), \
             patch("routing.viago_geometry._network_states", return_value=[40, 42]), \
             patch("routing.viago_geometry._lines_for_portions",
                   return_value=[([[-13.58, 9.64], [-13.57, 9.64]], 100, 5.0),
                                 ([[-13.50, 9.64], [-13.49, 9.64]], 100, 5.0)]):
            with self.assertRaises(ViagoGeometryUnavailable):
                make_viago_route(start_longitude=-13.58, start_latitude=9.64,
                                 end_longitude=-13.49, end_latitude=9.64,
                                 profile="car")

    def test_all_three_profiles_accepted_without_network_access(self):
        for profile in ("car", "motorcycle", "foot"):
            selection = {"status": "tie_requires_policy", "start_snap": snap(profile),
                         "end_snap": snap(profile, edge=21), "selected_candidate": None}
            with self.subTest(profile=profile), \
                 patch("routing.viago_geometry.compose_gps_route", return_value=selection):
                result = make_viago_route(start_longitude=-13.58, start_latitude=9.64,
                                          end_longitude=-13.57, end_latitude=9.65,
                                          profile=profile)
                self.assertEqual(result["profile"], profile)
                self.assertIsNone(result["geometry"])


if __name__ == "__main__":
    unittest.main()
