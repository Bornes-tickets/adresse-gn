from django.urls import path

from .views import (
    AccountListView,
    AccountReactivateView,
    BackofficeMeView,
    ClaimDecisionView,
    ClaimListView,
    InstallationUninstallView,
    PhysicalInstallationCompleteView,
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


urlpatterns += [
    path(
        "accounts/<uuid:user_id>/reactivate/",
        AccountReactivateView.as_view(),
        name="backoffice-account-reactivate",
    ),
]

urlpatterns += [
    path(
        "accounts/",
        AccountListView.as_view(),
        name="backoffice-accounts",
    ),
]



urlpatterns += [
    path(
        "pending-installations/"
        "<uuid:pending_installation_id>/"
        "complete/",
        PhysicalInstallationCompleteView.as_view(),
        name=(
            "backoffice-physical-installation-complete"
        ),
    ),
    path(
        "installations/"
        "<uuid:installation_id>/"
        "uninstall/",
        InstallationUninstallView.as_view(),
        name=(
            "backoffice-installation-uninstall"
        ),
    ),
]
