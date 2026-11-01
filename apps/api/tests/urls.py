"""URLConf minimal de la suite de tests Adresse GN."""

from django.urls import include, path


urlpatterns = [
    path(
        "api/v1/checkout/",
        include("checkout.urls"),
    ),
    path(
        "api/v1/tracking/",
        include("tracking.urls"),
    ),
    path(
        "api/v1/agent/",
        include("agent_portal.urls"),
    ),
]
