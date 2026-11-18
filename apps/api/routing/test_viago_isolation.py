"""Viago isolation contract; no real DB access."""
import unittest
from unittest.mock import patch, sentinel
from django.conf import settings
from routing import viago_geometry, viago_views


class ViagoIsolationTests(unittest.TestCase):
    def test_geometry_snapper_uses_exact_injected_connection(self):
        selection = {"status": "no_route", "selected_candidate": None}
        def fake_compose(*, snapper, state_od_executor, **kwargs):
            with patch.object(viago_geometry, "snap_point_to_routing_graph", return_value={"status": "no_routable_start"}) as spy:
                snapper(longitude=-13.6, latitude=9.6, profile="car", candidate_limit=64)
                self.assertIs(spy.call_args.kwargs["connection_obj"], sentinel.db)
            with patch.object(viago_geometry, "execute_state_od_matrix", return_value=[]) as spy:
                state_od_executor(profile="car", source_state_ids=[1], target_state_ids=[2])
                self.assertIs(spy.call_args.kwargs["connection_obj"], sentinel.db)
            return selection
        with patch.object(viago_geometry, "compose_gps_route", side_effect=fake_compose):
            result = viago_geometry.make_viago_route(start_longitude=-13.6, start_latitude=9.6,
                end_longitude=-13.5, end_latitude=9.7, profile="car", db_connection=sentinel.db)
        self.assertIsNone(result["geometry"])

    def test_view_fails_closed_without_routing_alias(self):
        with patch.object(viago_views, "connections") as connections:
            connections.databases = {}
            with patch.object(settings, "DEBUG", True):
                self.assertIsNone(viago_views._local_routing_connection())

    def test_view_rejects_remote_routing_host(self):
        with patch.object(viago_views, "connections") as connections:
            connections.databases = {"routing": {"ENGINE": "django.db.backends.postgresql",
                "HOST": "aws-1-eu-west-1.pooler.supabase.com", "PORT": "5432",
                "NAME": "postgres", "USER": "postgres", "OPTIONS": {}}}
            with patch.object(settings, "DEBUG", True):
                self.assertIsNone(viago_views._local_routing_connection())

    def test_view_accepts_local_read_only_routing_alias(self):
        with patch.object(viago_views, "connections") as connections:
            connections.databases = {"routing": {"ENGINE": "django.db.backends.postgresql",
                "HOST": "127.0.0.1", "PORT": "55433",
                "NAME": "adresse_gn_real_lab", "USER": "postgres",
                "OPTIONS": {"sslmode": "disable", "options": "-c default_transaction_read_only=on"}}}
            with patch.object(settings, "DEBUG", True):
                self.assertIs(viago_views._local_routing_connection(), connections["routing"])


if __name__ == "__main__":
    unittest.main()
