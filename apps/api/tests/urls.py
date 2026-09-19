"""URLConf minimal de la suite de tests Adresse GN."""

from django.urls import include, path


urlpatterns = [
    path(
        "api/v1/checkout/",
        include("checkout.urls"),
    ),
]
