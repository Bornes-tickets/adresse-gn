"""
Dedicated Block 13 HTTP-stack E2E settings.

This module extends the already validated routing E2E database
configuration but uses a dedicated URLConf.

It MUST NOT be used as the ordinary Adresse GN application
settings module.
"""

from .settings_routing_e2e import *  # noqa: F401,F403


ROOT_URLCONF = "config.urls_routing_e2e"

ALLOWED_HOSTS = [
    "testserver",
    "localhost",
    "127.0.0.1",
]

REST_FRAMEWORK = {
    # Real application authentication is not exercised by this
    # local routing transport test.
    #
    # APIClient.force_authenticate() injects the E2E identity.
    "DEFAULT_AUTHENTICATION_CLASSES": [],

    "DEFAULT_PERMISSION_CLASSES": [],

    # Avoid importing Django's AnonymousUser model because this
    # dedicated settings module intentionally has no auth DB.
    "UNAUTHENTICATED_USER": None,

    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],

    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
    ],
}