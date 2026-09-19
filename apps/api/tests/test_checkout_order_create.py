from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import UUID

from django.test import SimpleTestCase
from rest_framework.test import APIClient

from checkout.contracts import (
    normalize_client_type,
    normalize_payment_method,
    normalize_submission_channel,
)
from checkout.serializers import (
    CheckoutOrderCreateSerializer,
)
from checkout.services import (
    CheckoutVerificationError,
    _resolve_verified_identity,
    create_checkout_order,
)


USER_ID = (
    "7534ef08-ec07-49a9-98fa-ed864794b5e2"
)
PLAN_ID = UUID(
    "11111111-1111-4111-8111-111111111111"
)
ORDER_ID = UUID(
    "22222222-2222-4222-8222-222222222222"
)


def cursor_context(cursor):
    context = MagicMock()
    context.__enter__.return_value = cursor
    context.__exit__.return_value = False
    return context


class CheckoutContractTests(SimpleTestCase):
    def test_client_type_legacy_is_normalized(self):
        self.assertEqual(
            normalize_client_type(
                "institution"
            ),
            "institutionnel",
        )

    def test_payment_aliases_are_normalized(self):
        self.assertEqual(
            normalize_payment_method(
                "orange_money"
            ),
            "orange",
        )
        self.assertEqual(
            normalize_payment_method(
                "mtn_money"
            ),
            "mtn",
        )
        self.assertEqual(
            normalize_payment_method(
                "carte_bancaire"
            ),
            "card",
        )
        self.assertEqual(
            normalize_payment_method(
                "virement"
            ),
            "transfer",
        )

    def test_invalid_submission_channel_falls_back_web(
        self,
    ):
        self.assertEqual(
            normalize_submission_channel(
                "unknown"
            ),
            "web",
        )


class CheckoutSerializerTests(SimpleTestCase):
    def test_legacy_payload_becomes_canonical(self):
        serializer = CheckoutOrderCreateSerializer(
            data={
                "plan_code": "basic",
                "client_type": "institution",
                "full_name": "Institution Test",
                "payment_method": "orange_money",
                "lat": 9.6412,
                "lng": -13.5784,
            }
        )

        self.assertTrue(
            serializer.is_valid(),
            serializer.errors,
        )
        self.assertEqual(
            serializer.validated_data[
                "client_type"
            ],
            "institutionnel",
        )
        self.assertEqual(
            serializer.validated_data[
                "payment_method"
            ],
            "orange",
        )

    def test_lat_without_lng_is_rejected(self):
        serializer = CheckoutOrderCreateSerializer(
            data={
                "plan_code": "basic",
                "client_type": "particulier",
                "full_name": "Test",
                "lat": 9.6412,
            }
        )

        self.assertFalse(
            serializer.is_valid()
        )
        self.assertIn(
            "location",
            serializer.errors,
        )


class CheckoutVerificationTests(SimpleTestCase):
    def test_email_channel_uses_metadata_phone(self):
        verified_at = datetime(
            2026,
            9,
            19,
            9,
            0,
            tzinfo=timezone.utc,
        )

        result = _resolve_verified_identity(
            auth_phone=None,
            auth_email="user@example.com",
            phone_confirmed_at=None,
            email_confirmed_at=verified_at,
            user_metadata={
                (
                    "adresse_gn_"
                    "verification_channel"
                ): "email",
                (
                    "adresse_gn_"
                    "contact_phone"
                ): "+224611223344",
            },
            requested_email=(
                "USER@example.com"
            ),
        )

        self.assertEqual(
            result["channel"],
            "email",
        )
        self.assertEqual(
            result["phone"],
            "+224611223344",
        )
        self.assertEqual(
            result["identity_verified_at"],
            verified_at,
        )

    def test_email_mismatch_is_rejected(self):
        verified_at = datetime(
            2026,
            9,
            19,
            9,
            0,
            tzinfo=timezone.utc,
        )

        with self.assertRaises(
            CheckoutVerificationError
        ) as context:
            _resolve_verified_identity(
                auth_phone=None,
                auth_email="user@example.com",
                phone_confirmed_at=None,
                email_confirmed_at=verified_at,
                user_metadata={
                    (
                        "adresse_gn_"
                        "verification_channel"
                    ): "email",
                },
                requested_email=(
                    "other@example.com"
                ),
            )

        self.assertEqual(
            context.exception.code,
            "EMAIL_MISMATCH",
        )


class CheckoutServiceTests(SimpleTestCase):
    @patch(
        "checkout.services.transaction.atomic"
    )
    @patch(
        "checkout.services.connection"
    )
    def test_service_inserts_order_and_site_only(
        self,
        connection_mock,
        atomic_mock,
    ):
        verified_at = datetime(
            2026,
            9,
            19,
            9,
            0,
            tzinfo=timezone.utc,
        )

        cursor = MagicMock()
        cursor.fetchone.side_effect = [
            (
                "+224611223344",
                "user@example.com",
                verified_at,
                None,
                {
                    (
                        "adresse_gn_"
                        "verification_channel"
                    ): "sms",
                },
            ),
            (
                PLAN_ID,
                "basic",
                100000,
                0,
                "Basique",
            ),
            (
                ORDER_ID,
                "ORD-20260919-00001",
            ),
        ]

        connection_mock.cursor.return_value = (
            cursor_context(cursor)
        )
        atomic_mock.return_value = (
            cursor_context(MagicMock())
        )

        result = create_checkout_order(
            user_id=USER_ID,
            payload={
                "plan_code": "basic",
                "client_type": "particulier",
                "full_name": "Utilisateur Test",
                "email": "contact@example.com",
                "payment_method": "orange",
                "place_type": "home",
                "place_name": "Maison",
                "lat": 9.6412,
                "lng": -13.5784,
                "accuracy_m": 5,
                "address_line": "Conakry",
                "access_point_note": (
                    "Portail principal"
                ),
                "devis_demande": False,
                "submission_channel": "web",
            },
        )

        self.assertEqual(
            result["order_id"],
            str(ORDER_ID),
        )
        self.assertEqual(
            result["order_ref"],
            "ORD-20260919-00001",
        )

        executed_sql = "\n".join(
            str(call.args[0])
            for call
            in cursor.execute.call_args_list
        )

        self.assertIn(
            "INSERT INTO public.orders",
            executed_sql,
        )
        self.assertIn(
            "INSERT INTO public.order_sites",
            executed_sql,
        )
        self.assertIn(
            "request.jwt.claim.sub",
            executed_sql,
        )
        self.assertNotIn(
            "INSERT INTO public.order_events",
            executed_sql,
        )


class CheckoutOrderCreateViewTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(
            user=SimpleNamespace(
                id=USER_ID,
                is_authenticated=True,
            )
        )

    @patch(
        "checkout.views.create_checkout_order"
    )
    def test_endpoint_returns_created_order(
        self,
        create_mock,
    ):
        create_mock.return_value = {
            "order_id": str(ORDER_ID),
            "order_ref": (
                "ORD-20260919-00001"
            ),
        }

        response = self.client.post(
            "/api/v1/checkout/orders/",
            {
                "plan_code": "basic",
                "client_type": "institution",
                "full_name": (
                    "Institution Test"
                ),
                "payment_method": (
                    "orange_money"
                ),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            201,
        )
        self.assertEqual(
            response.data["order_ref"],
            "ORD-20260919-00001",
        )

        create_mock.assert_called_once()
        kwargs = (
            create_mock.call_args.kwargs
        )

        self.assertEqual(
            kwargs["user_id"],
            USER_ID,
        )
        self.assertEqual(
            kwargs["payload"][
                "client_type"
            ],
            "institutionnel",
        )
        self.assertEqual(
            kwargs["payload"][
                "payment_method"
            ],
            "orange",
        )
