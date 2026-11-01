from __future__ import annotations

import inspect
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import resolve

from payments.permissions import IsSalesTeam
from payments.services import (
    confirm_sales_order_manual_payment_with_invoice,
    ensure_sales_manual_payment_for_order,
)
from payments.views import (
    SalesOrderManualConfirmView,
)


class SalesOrderManualValidationTests(
    SimpleTestCase
):
    def test_preparation_has_order_lock_and_manual_payment_contract(
        self,
    ):
        source = inspect.getsource(
            ensure_sales_manual_payment_for_order
        )

        normalized = " ".join(
            source.split()
        )

        self.assertIn(
            "FOR UPDATE",
            source,
        )

        self.assertIn(
            "p.provider = 'manual'",
            normalized,
        )

        self.assertIn(
            "p.status = 'pending'",
            normalized,
        )

        self.assertIn(
            "INSERT INTO public.payments",
            source,
        )

        self.assertIn(
            "sales_manual_{clean_order_ref}_",
            source,
        )


    def test_confirmation_delegates_to_canonical_invoice_workflow(
        self,
    ):
        prepared = {
            "payment_id": (
                "11111111-1111-1111-1111-111111111111"
            ),
            "order_id": (
                "22222222-2222-2222-2222-222222222222"
            ),
            "order_ref": "ORD-TEST-0001",
            "created": True,
        }

        canonical_result = {
            "ok": True,
            "payment_confirmed": True,
            "order_id": prepared["order_id"],
            "confirmation": {},
            "invoice_state": "published",
            "invoice": {},
            "publication": {},
            "invoice_error": None,
        }

        with patch(
            "payments.services.ensure_sales_manual_payment_for_order",
            return_value=prepared,
        ) as prepare_mock:
            with patch(
                "payments.services.confirm_manual_payment_with_invoice",
                return_value=canonical_result,
            ) as confirm_mock:
                result = (
                    confirm_sales_order_manual_payment_with_invoice(
                        actor_id=(
                            "33333333-3333-3333-3333-333333333333"
                        ),
                        order_ref="ORD-TEST-0001",
                        external_ref="RECU-TEST-001",
                        note="Test",
                    )
                )

        prepare_mock.assert_called_once_with(
            order_ref="ORD-TEST-0001",
        )

        confirm_mock.assert_called_once_with(
            actor_id=(
                "33333333-3333-3333-3333-333333333333"
            ),
            payment_id=prepared["payment_id"],
            external_ref="RECU-TEST-001",
            note="Test",
        )

        self.assertEqual(
            result["payment_id"],
            prepared["payment_id"],
        )

        self.assertTrue(
            result[
                "payment_created_for_confirmation"
            ]
        )


    def test_order_confirm_route_is_order_reference_scoped(
        self,
    ):
        match = resolve(
            "/sales/orders/ORD-TEST-0001/confirm/",
            urlconf="payments.urls",
        )

        self.assertEqual(
            match.url_name,
            "sales-order-manual-confirm",
        )

        self.assertEqual(
            match.kwargs[
                "order_ref"
            ],
            "ORD-TEST-0001",
        )


    def test_order_confirm_view_keeps_sales_permission(
        self,
    ):
        self.assertIn(
            IsSalesTeam,
            SalesOrderManualConfirmView.permission_classes,
        )
