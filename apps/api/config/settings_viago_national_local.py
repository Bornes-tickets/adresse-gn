"""Viago : routage sur le graphe national restaure, en LOCAL uniquement.

Module autonome (n'importe pas config.settings) : aucun acces a la base
Adresse GN, aucune ecriture possible dans la base de routage.

    DJANGO_SETTINGS_MODULE=config.settings_viago_national_local
    VIAGO_STAGING_BEARER_TOKEN=<32 caracteres minimum>
    python manage.py runserver 127.0.0.1:18765 --noreload

Expose uniquement config.urls_viago_staging (sante + route protegee par jeton).
Ne jamais deployer ce module.
"""
from __future__ import annotations

import os

from django.core.exceptions import ImproperlyConfigured

DEBUG = False
SECRET_KEY = os.environ.get("VIAGO_LOCAL_SECRET_KEY", "viago-local-only-not-a-secret")
ALLOWED_HOSTS = ["127.0.0.1", "localhost"]
ROOT_URLCONF = "config.urls_viago_staging"
USE_TZ = True
INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "rest_framework",
]
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

VIAGO_STAGING_BEARER_TOKEN = os.environ.get("VIAGO_STAGING_BEARER_TOKEN", "").strip()
if len(VIAGO_STAGING_BEARER_TOKEN) < 32:
    raise ImproperlyConfigured(
        "VIAGO_STAGING_BEARER_TOKEN (32 caracteres minimum) est requis."
    )

_host = os.environ.get("VIAGO_NATIONAL_DB_HOST", "127.0.0.1")
if _host not in {"127.0.0.1", "localhost"}:
    raise ImproperlyConfigured("Le graphe national local doit etre sur 127.0.0.1.")

DATABASES = {
    "default": {"ENGINE": "django.db.backends.dummy"},
    # Meme alias que le staging : la vue existante est reutilisee telle quelle.
    "viago_routing": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("VIAGO_NATIONAL_DB_NAME", "viago_routing_validation"),
        "USER": os.environ.get("VIAGO_NATIONAL_DB_USER", "postgres"),
        "PASSWORD": os.environ.get("VIAGO_NATIONAL_DB_PASSWORD", ""),
        "HOST": _host,
        "PORT": os.environ.get("VIAGO_NATIONAL_DB_PORT", "55434"),
        "CONN_MAX_AGE": 60,
        "ATOMIC_REQUESTS": False,
        "OPTIONS": {
            "sslmode": "disable",
            "connect_timeout": 5,
            "application_name": "viago-national-local",
            "options": "-c default_transaction_read_only=on",
        },
    },
}

REST_FRAMEWORK = {
    "DEFAULT_THROTTLE_RATES": {"viago_staging_route": "120/min"},
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
}
