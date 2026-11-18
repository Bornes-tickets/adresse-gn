from django.conf import settings
from django.http import JsonResponse
from django.urls import include, path

from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
)

from config.auth_views import (
    AuthMeView,
)


def health_check(request):
    return JsonResponse(
        {
            "status": "ok",
            "service": "adresse-gn-api",
        }
    )


urlpatterns = [
    path(
        "api/health/",
        health_check,
        name="health",
    ),

    path(
        "api/v1/addresses/",
        include("addresses.urls"),
    ),

    path(
        "api/v1/public/",
        include("public_catalog.urls"),
    ),

    path(
        "api/v1/checkout/",
        include("checkout.urls"),
    ),

    path(
        "api/v1/tracking/",
        include("tracking.urls"),
    ),

    path(
        "api/v1/backoffice/",
        include("backoffice.urls"),
    ),

    path(
        "api/v1/agent/",
        include("agent_portal.urls"),
    ),

    path(
        "api/v1/owner/",
        include("owner_portal.urls"),
    ),

    path(
        "api/v1/auth/me/",
        AuthMeView.as_view(),
        name="auth-me",
    ),

    path(
        "api/v1/payments/",
        include("payments.urls"),
    ),

]


if settings.DEBUG or settings.ENABLE_API_DOCS:
    urlpatterns += [
        path(
            "api/schema/",
            SpectacularAPIView.as_view(),
            name="schema",
        ),
        path(
            "api/docs/",
            SpectacularSwaggerView.as_view(
                url_name="schema"
            ),
            name="swagger-ui",
        ),
    ]


# VIAGO-V1-P1 — explicit local-only route registration
# Never mounted in production; requires DEBUG and an opt-in environment flag.
import os as _viago_os
if settings.DEBUG and _viago_os.environ.get("VIAGO_LOCAL_ROUTING_ENABLED") == "1":
    from routing.viago_views import ViagoLocalRouteView
    urlpatterns += [
        path("api/v1/viago/route/", ViagoLocalRouteView.as_view(), name="viago-local-route"),
    ]
