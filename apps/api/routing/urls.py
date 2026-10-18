from django.urls import path

from .views import (
    InternalStateToStateRouteView,
)


urlpatterns = [
    path(
        "state-to-state/",
        InternalStateToStateRouteView.as_view(),
        name="internal-state-to-state-route",
    ),
]