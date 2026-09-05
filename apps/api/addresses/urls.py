from django.urls import path

from .views import (
    AddressDetailView,
    AddressReportView,
    AddressSearchView,
    RouteLogView,
)


urlpatterns = [
    path(
        "search/",
        AddressSearchView.as_view(),
        name="address-search",
    ),

    path(
        "<str:number>/route/",
        RouteLogView.as_view(),
        name="address-route-log",
    ),

    path(
        "<str:number>/report/",
        AddressReportView.as_view(),
        name="address-report",
    ),

    path(
        "<str:number>/",
        AddressDetailView.as_view(),
        name="address-detail",
    ),
]