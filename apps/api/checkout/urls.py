from django.urls import path

from .views import CheckoutOrderCreateView


urlpatterns = [
    path(
        "orders/",
        CheckoutOrderCreateView.as_view(),
        name="checkout-order-create",
    ),
]
