from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import (
    PaymentAlreadyPaidError,
    PaymentError,
    PaymentOrderNotFoundError,
    PaymentOrderNotPayableError,
    get_payment_order,
    initiate_manual_payment,
    payment_methods,
)


def _user_id(request) -> str | None:
    value = getattr(
        request.user,
        "id",
        None,
    )

    return (
        str(value)
        if value
        else None
    )


class PaymentMethodsView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    def get(self, request):
        return Response(
            {
                "items": payment_methods(),
            },
            status=status.HTTP_200_OK,
        )


class PaymentOrderDetailView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    def get(
        self,
        request,
        order_ref: str,
    ):
        user_id = _user_id(request)

        if not user_id:
            return Response(
                {
                    "detail": "Authentification requise.",
                    "code": "AUTH_REQUIRED",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            result = get_payment_order(
                user_id=user_id,
                order_ref=order_ref,
            )

        except PaymentOrderNotFoundError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "code": exc.code,
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            result,
            status=status.HTTP_200_OK,
        )


class PaymentOrderManualView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    def post(
        self,
        request,
        order_ref: str,
    ):
        user_id = _user_id(request)

        if not user_id:
            return Response(
                {
                    "detail": "Authentification requise.",
                    "code": "AUTH_REQUIRED",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            result = initiate_manual_payment(
                user_id=user_id,
                order_ref=order_ref,
            )

        except PaymentOrderNotFoundError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "code": exc.code,
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        except (
            PaymentAlreadyPaidError,
            PaymentOrderNotPayableError,
        ) as exc:
            return Response(
                {
                    "detail": str(exc),
                    "code": exc.code,
                },
                status=status.HTTP_409_CONFLICT,
            )

        except PaymentError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "code": exc.code,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            result,
            status=status.HTTP_200_OK,
        )


from .permissions import IsSalesTeam
from .services import (
    SalesPaymentError,
    SalesPaymentNotFoundError,
    SalesPaymentStateError,
    list_sales_payments,
    reject_manual_payment,
)


class SalesPaymentListView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsSalesTeam,
    ]

    def get(self, request):
        try:
            result = list_sales_payments(
                status_filter=request.query_params.get(
                    "status",
                    "pending",
                ),
                page=int(
                    request.query_params.get(
                        "page",
                        "1",
                    )
                ),
                page_size=int(
                    request.query_params.get(
                        "page_size",
                        "25",
                    )
                ),
            )

        except (
            ValueError,
            SalesPaymentStateError,
        ) as exc:
            return Response(
                {
                    "detail": str(exc),
                    "code": (
                        exc.code
                        if isinstance(
                            exc,
                            SalesPaymentError,
                        )
                        else "INVALID_PAGINATION"
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            result,
            status=status.HTTP_200_OK,
        )


class SalesPaymentRejectView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsSalesTeam,
    ]

    def post(
        self,
        request,
        payment_id,
    ):
        actor_id = _user_id(
            request
        )

        reason = str(
            request.data.get(
                "reason",
                "",
            )
        )

        try:
            result = reject_manual_payment(
                actor_id=str(
                    actor_id
                ),
                payment_id=str(
                    payment_id
                ),
                reason=reason,
            )

        except SalesPaymentNotFoundError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "code": exc.code,
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        except SalesPaymentStateError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "code": exc.code,
                },
                status=status.HTTP_409_CONFLICT,
            )

        except SalesPaymentError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "code": exc.code,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            result,
            status=status.HTTP_200_OK,
        )

from .services import (
    ManualPaymentInvoiceOrchestrationError,
    SalesPaymentConfirmError,
    SalesPaymentConfirmStateError,
    SalesPaymentFulfillmentError,
    confirm_manual_payment_with_invoice,
)


# PHASE 15G2B12 — secured Sales manual confirmation endpoint
class SalesPaymentConfirmView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsSalesTeam,
    ]

    def post(
        self,
        request,
        payment_id,
    ):
        actor_id = _user_id(
            request
        )

        if not actor_id:
            return Response(
                {
                    "detail": "Authentification requise.",
                    "code": "AUTH_REQUIRED",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        external_ref = str(
            request.data.get(
                "external_ref",
                "",
            )
            or ""
        ).strip()

        if not external_ref:
            return Response(
                {
                    "detail": "La référence externe est obligatoire.",
                    "code": "EXTERNAL_REF_REQUIRED",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(external_ref) > 200:
            return Response(
                {
                    "detail": "La référence externe est trop longue.",
                    "code": "EXTERNAL_REF_TOO_LONG",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_note = request.data.get(
            "note"
        )

        if raw_note is None:
            note = None
        else:
            note = str(
                raw_note
            ).strip() or None

        if (
            note is not None
            and len(note) > 1000
        ):
            return Response(
                {
                    "detail": "La note est trop longue.",
                    "code": "NOTE_TOO_LONG",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = (
                confirm_manual_payment_with_invoice(
                    actor_id=str(
                        actor_id
                    ),
                    payment_id=str(
                        payment_id
                    ),
                    external_ref=external_ref,
                    note=note,
                )
            )

        except SalesPaymentNotFoundError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "code": exc.code,
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        except (
            SalesPaymentConfirmStateError,
            SalesPaymentFulfillmentError,
            SalesPaymentStateError,
            ManualPaymentInvoiceOrchestrationError,
        ) as exc:
            return Response(
                {
                    "detail": str(exc),
                    "code": getattr(
                        exc,
                        "code",
                        "PAYMENT_CONFIRM_STATE_INVALID",
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )

        except SalesPaymentConfirmError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "code": exc.code,
                },
                status=status.HTTP_409_CONFLICT,
            )

        except SalesPaymentError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "code": exc.code,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        except RuntimeError:
            return Response(
                {
                    "detail": (
                        "Configuration de facturation indisponible."
                    ),
                    "code": "INVOICE_CONFIGURATION_REQUIRED",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            result,
            status=status.HTTP_200_OK,
        )
