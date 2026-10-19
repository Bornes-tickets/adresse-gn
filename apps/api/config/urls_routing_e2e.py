"""
Dedicated non-production URLConf for Block 13 routing HTTP E2E.

This file is intentionally separate from config.urls.
"""

from django.urls import include, path


urlpatterns = [
    path(
        "internal/routing/",
        include("routing.urls"),
    ),
]