"""Viago local routing-only alias; never deploy this settings module.

Normal Adresse GN auth remains untouched. Routing queries must exclusively use
DATABASES["routing"], whose PostgreSQL connection is forced READ ONLY.
"""
import os
from .settings import *  # noqa: F401,F403 -- deliberately extends local application settings

if os.environ.get("VIAGO_LOCAL_ROUTING_ENABLED") != "1":
    raise RuntimeError("Viago local settings require explicit opt-in")

_password = os.environ.get("VIAGO_ROUTING_PASSWORD", "")
if not _password:
    raise RuntimeError("Missing VIAGO_ROUTING_PASSWORD for isolated local routing DB")

# A copy prevents mutating the imported application's DATABASES dictionary.
DATABASES = {
    **DATABASES,
    "routing": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "adresse_gn_real_lab",
        "USER": "postgres",
        "PASSWORD": _password,
        "HOST": "127.0.0.1",
        "PORT": "55433",
        "CONN_MAX_AGE": 0,
        "OPTIONS": {
            "sslmode": "disable",
            "options": "-c default_transaction_read_only=on",
            "connect_timeout": 5,
        },
    },
}
