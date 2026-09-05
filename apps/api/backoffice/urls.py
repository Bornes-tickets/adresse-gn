from django.urls import path

from .views import (
    BackofficeMeView,
    ClaimDecisionView,
    ClaimListView,
)


urlpatterns = [
    path(
        "me/",
        BackofficeMeView.as_view(),
        name="backoffice-me",
    ),

    path(
        "claims/",
        ClaimListView.as_view(),
        name="backoffice-claims",
    ),

    path(
        "claims/<uuid:claim_id>/decision/",
        ClaimDecisionView.as_view(),
        name="backoffice-claim-decision",
    ),
]