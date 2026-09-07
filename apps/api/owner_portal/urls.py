from django.urls import path

from .views import (
    OwnerBeaconDetailView,
    OwnerBeaconListView,
    OwnerDashboardView,
    OwnerBeaconSuspendView,
    OwnerFavoriteDetailView,
    OwnerFavoriteListCreateView,
    OwnerMovingReportView,
    OwnerOrderListView,
    OwnerReportListView,
    OwnerClaimListView,
    OwnerProfileView,
    OwnerAccountDeactivateView,
)


urlpatterns = [
    path(
        "account/deactivate/",
        OwnerAccountDeactivateView.as_view(),
        name="owner-account-deactivate",
    ),

    path(
        "profile/",
        OwnerProfileView.as_view(),
        name="owner-profile",
    ),

    path(
        "reports/",
        OwnerReportListView.as_view(),
        name="owner-reports",
    ),

    path(
        "claims/",
        OwnerClaimListView.as_view(),
        name="owner-claims",
    ),

    path(
        "orders/",
        OwnerOrderListView.as_view(),
        name="owner-orders",
    ),

    path(
        "favorites/",
        OwnerFavoriteListCreateView.as_view(),
        name="owner-favorites",
    ),

    path(
        "favorites/<uuid:favorite_id>/",
        OwnerFavoriteDetailView.as_view(),
        name="owner-favorite-detail",
    ),

    path(
        "dashboard/",
        OwnerDashboardView.as_view(),
        name="owner-dashboard",
    ),

    path(
        "beacons/",
        OwnerBeaconListView.as_view(),
        name="owner-beacons",
    ),

    path(
        "beacons/<uuid:address_id>/",
        OwnerBeaconDetailView.as_view(),
        name="owner-beacon-detail",
    ),

    path(
        "beacons/<uuid:address_id>/suspend/",
        OwnerBeaconSuspendView.as_view(),
        name="owner-beacon-suspend",
    ),

    path(
        "beacons/<uuid:address_id>/moving-report/",
        OwnerMovingReportView.as_view(),
        name="owner-beacon-moving-report",
    ),
]
