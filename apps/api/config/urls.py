from django.urls import include, path

from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
)

from config.auth_views import (
    AuthMeView,
)


urlpatterns = [
    path(
        "api/v1/addresses/",
        include("addresses.urls"),
    ),

    path(
        "api/v1/auth/me/",
        AuthMeView.as_view(),
        name="auth-me",
    ),

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
