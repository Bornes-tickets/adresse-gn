from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import UUID

from django.test import SimpleTestCase
from rest_framework.test import APIClient

from tracking.services import (
    _derive_public_status,
    _mask_phone,
    fetch_public_order_by_token,
)


ORDER_ID = UUID("22222222-2222-4222-8222-222222222222")
TOKEN = "AbCdEf012345_-xy"


def cursor_context(cursor):
    context = MagicMock()
    context.__enter__.return_value = cursor
    context.__exit__.return_value = False
    return context


class TrackingStatusTests(SimpleTestCase):
    def test_cancelled_wins(self):
        self.assertEqual(
            _derive_public_status(
                order_status="cancelled",
                devis_demande=False,
                fulfillment_kind="physical_installation",
                installation_status="done",
                address_active=True,
            ),
            "cancelled",
        )

    def test_quote_stays_pending(self):
        self.assertEqual(
            _derive_public_status(
                order_status="pending",
                devis_demande=True,
                fulfillment_kind="professional_quote",
                installation_status=None,
                address_active=False,
            ),
            "pending",
        )

    def test_paid_digital_is_confirmed(self):
        self.assertEqual(
            _derive_public_status(
                order_status="paid",
                devis_demande=False,
                fulfillment_kind="digital_address",
                installation_status=None,
                address_active=False,
            ),
            "confirmed",
        )

    def test_planned_installation_is_in_progress(self):
        self.assertEqual(
            _derive_public_status(
                order_status="paid",
                devis_demande=False,
                fulfillment_kind="physical_installation",
                installation_status="planned",
                address_active=False,
            ),
            "in_progress",
        )

    def test_done_installation_is_installed(self):
        self.assertEqual(
            _derive_public_status(
                order_status="paid",
                devis_demande=False,
                fulfillment_kind="physical_installation",
                installation_status="done",
                address_active=False,
            ),
            "installed",
        )

    def test_active_address_wins(self):
        self.assertEqual(
            _derive_public_status(
                order_status="paid",
                devis_demande=False,
                fulfillment_kind="physical_installation",
                installation_status="done",
                address_active=True,
            ),
            "active",
        )

    def test_phone_is_masked(self):
        self.assertEqual(_mask_phone("+224611223344"), "+22461•••344")


class TrackingServiceTests(SimpleTestCase):
    @patch("tracking.services.connection")
    def test_service_returns_minimal_public_shape(self, connection_mock):
        cursor = MagicMock()
        cursor.fetchone.return_value = (
            ORDER_ID,
            "ORD-20260919-00001",
            "paid",
            "particulier",
            "Utilisateur Test",
            "+224611223344",
            "Conakry",
            None,
            "residentiel_standard",
            "Résidentiel Standard",
            150000,
            "orange",
            False,
            "physical_installation",
            "planned",
            datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc),
            False,
        )
        connection_mock.cursor.return_value = cursor_context(cursor)
        result = fetch_public_order_by_token(TOKEN)
        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "in_progress")
        self.assertEqual(result["phone"], "+22461•••344")
        self.assertNotIn("email", result)
        self.assertNotIn("guest_token", result)

    @patch("tracking.services.connection")
    def test_invalid_token_does_not_query_db(self, connection_mock):
        self.assertIsNone(fetch_public_order_by_token("invalid/token"))
        connection_mock.cursor.assert_not_called()


class TrackingViewTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()

    @patch("tracking.views.fetch_public_order_by_token")
    def test_public_endpoint_returns_order(self, fetch_mock):
        fetch_mock.return_value = {
            "id": str(ORDER_ID),
            "order_ref": "ORD-20260919-00001",
            "status": "pending",
            "client_type": "particulier",
            "full_name": "Utilisateur Test",
            "phone": "+22461•••344",
            "address_line": "Conakry",
            "quartier": None,
            "formule_code": "numerique",
            "formule_label": "Numérique seule",
            "prix_ttc": 40000,
            "payment_method": "orange",
            "devis_demande": False,
            "fulfillment_kind": "digital_address",
            "installation_status": None,
            "created_at": datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc),
        }
        response = self.client.get(f"/api/v1/tracking/orders/{TOKEN}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["order_ref"], "ORD-20260919-00001")

    @patch("tracking.views.fetch_public_order_by_token")
    def test_public_endpoint_returns_404(self, fetch_mock):
        fetch_mock.return_value = None
        response = self.client.get(f"/api/v1/tracking/orders/{TOKEN}/")
        self.assertEqual(response.status_code, 404)
