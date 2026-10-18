from __future__ import annotations

import os
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


os.environ.setdefault(
    "ROUTING_E2E_HOST",
    "127.0.0.1",
)

os.environ.setdefault(
    "ROUTING_E2E_PORT",
    "55433",
)

os.environ.setdefault(
    "ROUTING_E2E_NAME",
    "adresse_gn_real_lab",
)

os.environ.setdefault(
    "ROUTING_E2E_USER",
    "postgres",
)

os.environ.setdefault(
    "ROUTING_E2E_PASSWORD",
    "",
)

os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "config.settings_routing_e2e",
)


import django


django.setup()


from rest_framework import status  # noqa: E402

from routing.serializers import (  # noqa: E402
    StateToStateRouteSerializer,
)
from routing.services import (  # noqa: E402
    RoutingBackendError,
    RoutingBackendNotConfigured,
)
from routing.views import (  # noqa: E402
    InternalStateToStateRouteView,
)


class RoutingApiContractTests(
    unittest.TestCase
):
    def _request(
        self,
        *,
        start_state_id,
        end_state_id,
    ):
        return SimpleNamespace(
            data={
                "start_state_id": (
                    start_state_id
                ),
                "end_state_id": (
                    end_state_id
                ),
            }
        )

    def test_serializer_accepts_valid_bigint_ids(self):
        serializer = (
            StateToStateRouteSerializer(
                data={
                    "start_state_id": 417992,
                    "end_state_id": 398405,
                }
            )
        )

        self.assertTrue(
            serializer.is_valid(),
            serializer.errors,
        )

    def test_serializer_rejects_negative_ids(self):
        serializer = (
            StateToStateRouteSerializer(
                data={
                    "start_state_id": -1,
                    "end_state_id": 2,
                }
            )
        )

        self.assertFalse(
            serializer.is_valid()
        )

        self.assertIn(
            "start_state_id",
            serializer.errors,
        )

    def test_serializer_rejects_bigint_overflow(self):
        serializer = (
            StateToStateRouteSerializer(
                data={
                    "start_state_id": (
                        9223372036854775808
                    ),
                    "end_state_id": 2,
                }
            )
        )

        self.assertFalse(
            serializer.is_valid()
        )

        self.assertIn(
            "start_state_id",
            serializer.errors,
        )

    def test_reachable_response_contract(self):
        view = (
            InternalStateToStateRouteView()
        )

        request = self._request(
            start_state_id=417992,
            end_state_id=398405,
        )

        with patch(
            "routing.views.route_state_to_state",
            return_value={
                "reachable": True,
                "total_cost": (
                    711.0470099089517
                ),
                "start_state_id": 417992,
                "end_state_id": 398405,
            },
        ) as mocked_service:

            response = view.post(
                request
            )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data,
            {
                "status": "ok",
                "profile": "car",
                "start_state_id": 417992,
                "end_state_id": 398405,
                "reachable": True,
                "total_cost": (
                    711.0470099089517
                ),
            },
        )

        mocked_service.assert_called_once_with(
            start_state_id=417992,
            end_state_id=398405,
        )

    def test_unreachable_response_contract(self):
        view = (
            InternalStateToStateRouteView()
        )

        request = self._request(
            start_state_id=1030028,
            end_state_id=2,
        )

        with patch(
            "routing.views.route_state_to_state",
            return_value={
                "reachable": False,
                "total_cost": None,
                "start_state_id": 1030028,
                "end_state_id": 2,
            },
        ):

            response = view.post(
                request
            )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["reachable"],
            False,
        )

        self.assertIsNone(
            response.data["total_cost"]
        )

    def test_start_equals_end_response_contract(self):
        view = (
            InternalStateToStateRouteView()
        )

        request = self._request(
            start_state_id=2,
            end_state_id=2,
        )

        with patch(
            "routing.views.route_state_to_state",
            return_value={
                "reachable": True,
                "total_cost": 0.0,
                "start_state_id": 2,
                "end_state_id": 2,
            },
        ):

            response = view.post(
                request
            )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertTrue(
            response.data["reachable"]
        )

        self.assertEqual(
            response.data["total_cost"],
            0.0,
        )

    def test_backend_not_configured_maps_to_503(self):
        view = (
            InternalStateToStateRouteView()
        )

        request = self._request(
            start_state_id=1,
            end_state_id=2,
        )

        with patch(
            "routing.views.route_state_to_state",
            side_effect=(
                RoutingBackendNotConfigured(
                    "test"
                )
            ),
        ):

            response = view.post(
                request
            )

        self.assertEqual(
            response.status_code,
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )

        self.assertEqual(
            response.data["code"],
            "routing_backend_unavailable",
        )

    def test_backend_contract_error_maps_to_502(self):
        view = (
            InternalStateToStateRouteView()
        )

        request = self._request(
            start_state_id=1,
            end_state_id=2,
        )

        with patch(
            "routing.views.route_state_to_state",
            side_effect=(
                RoutingBackendError(
                    "test"
                )
            ),
        ):

            response = view.post(
                request
            )

        self.assertEqual(
            response.status_code,
            status.HTTP_502_BAD_GATEWAY,
        )

        self.assertEqual(
            response.data["code"],
            (
                "routing_backend_invalid_response"
            ),
        )

    def test_api_view_requires_authentication(self):
        from rest_framework.permissions import (
            IsAuthenticated,
        )

        self.assertEqual(
            InternalStateToStateRouteView
            .permission_classes,
            [
                IsAuthenticated,
            ],
        )

    def test_root_urlconf_does_not_mount_routing_api(self):
        repo_root = (
            Path(__file__)
            .resolve()
            .parents[3]
        )

        config_urls = (
            repo_root
            / "apps"
            / "api"
            / "config"
            / "urls.py"
        )

        text = config_urls.read_text(
            encoding="utf-8-sig"
        )

        self.assertNotIn(
            'include("routing.urls")',
            text,
        )

        self.assertNotIn(
            "include('routing.urls')",
            text,
        )


if __name__ == "__main__":
    unittest.main()