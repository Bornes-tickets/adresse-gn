from django.urls import path

from .views import (
    OwnerBeaconDetailView,
    OwnerBeaconListView,
    OwnerBeaconSuspendView,
    OwnerMovingReportView,
)


urlpatterns = [
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