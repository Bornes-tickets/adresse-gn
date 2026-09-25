from django.urls import path

from .views import (
    PaymentMethodsView,
    PaymentOrderDetailView,
    PaymentOrderManualView,
    SalesPaymentListView,
    SalesPaymentRejectView,
    SalesPaymentConfirmView,
)


urlpatterns = [
    path(
        "methods/",
        PaymentMethodsView.as_view(),
        name="payment-methods",
    ),
    path(
        "orders/<str:order_ref>/",
        PaymentOrderDetailView.as_view(),
        name="payment-order-detail",
    ),
    path(
        "orders/<str:order_ref>/manual/",
        PaymentOrderManualView.as_view(),
        name="payment-order-manual",
    ),
    path(
        "sales/",
        SalesPaymentListView.as_view(),
        name="sales-payment-list",
    ),
    path(
        "sales/<uuid:payment_id>/reject/",
        SalesPaymentRejectView.as_view(),
        name="sales-payment-reject",
    ),

    # PHASE 15G2B12 — Sales confirm route
    path(
        "sales/<uuid:payment_id>/confirm/",
        SalesPaymentConfirmView.as_view(),
        name="sales-payment-confirm",
    ),
]
