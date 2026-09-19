from django.urls import path

from .views import PublicTrackingOrderView


urlpatterns = [
    path(
        "orders/<str:token>/",
        PublicTrackingOrderView.as_view(),
        name="public-tracking-order",
    ),
]
