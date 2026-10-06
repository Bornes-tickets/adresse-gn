from django.urls import path

from .views import (
    AccountListView,
    AccountReactivateView,
    BackofficeMeView,
    ClaimDecisionView,
    ClaimListView,
    InstallationUninstallView,
    PhysicalInstallationAssignView,
    PhysicalInstallationFieldCompleteView,
    PhysicalAddressPublishView,
    PhysicalInstallationReassignView,
    PhysicalInstallationScheduleView,
    PhysicalInstallationValidateView,
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
        "assign/",
        PhysicalInstallationAssignView.as_view(),
        name="backoffice-physical-installation-assign",
    ),
    path(
        "pending-installations/"
        "<uuid:pending_installation_id>/"
        "reassign/",
        PhysicalInstallationReassignView.as_view(),
        name="backoffice-physical-installation-reassign",
    ),
    path(
        "pending-installations/"
        "<uuid:pending_installation_id>/"
        "schedule/",
        PhysicalInstallationScheduleView.as_view(),
        name="backoffice-physical-installation-schedule",
    ),
    path(
        "pending-installations/"
        "<uuid:pending_installation_id>/"
        "publish/",
        PhysicalAddressPublishView.as_view(),
        name="backoffice-physical-address-publish",
    ),
    path(
        "pending-installations/"
        "<uuid:pending_installation_id>/"
        "validate/",
        PhysicalInstallationValidateView.as_view(),
        name="backoffice-physical-installation-validate",
    ),
    path(
        "pending-installations/"
        "<uuid:pending_installation_id>/"
        "field-complete/",
        PhysicalInstallationFieldCompleteView.as_view(),
        name=(
            "backoffice-physical-installation-field-complete"
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
