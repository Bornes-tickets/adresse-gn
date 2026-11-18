"""Separate URLConf: no Adresse GN or local-lab endpoints are exposed."""
from django.http import JsonResponse
from django.urls import path
from django.views.decorators.http import require_GET

from routing.viago_staging_views import ViagoStagingRouteView


@require_GET
def viago_staging_health(_request):
    # No DB access, no credentials, no internal configuration in the response.
    return JsonResponse({"status": "ok", "service": "viago-staging"})


urlpatterns = [
    path("viago-staging/health/", viago_staging_health),
    path("viago-staging/api/route/", ViagoStagingRouteView.as_view()),
]
