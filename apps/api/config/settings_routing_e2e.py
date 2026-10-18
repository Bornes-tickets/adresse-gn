"""
Dedicated Django settings for Block 13 routing-service E2E.

SAFETY CONTRACT
---------------
This module is intentionally isolated from normal Adresse GN settings.

It may connect only to:

    host = 127.0.0.1
    port = 55433
    db   = adresse_gn_real_lab
    user = postgres

The routing connection is forced into PostgreSQL
default_transaction_read_only=on.

The default Django database is an in-memory SQLite database so
this E2E module cannot accidentally use the normal application
database.
"""

import os


EXPECTED_ROUTING_HOST = "127.0.0.1"
EXPECTED_ROUTING_PORT = "55433"
EXPECTED_ROUTING_NAME = "adresse_gn_real_lab"
EXPECTED_ROUTING_USER = "postgres"


SECRET_KEY = "block13-routing-e2e-local-only"

DEBUG = False

USE_TZ = True

TIME_ZONE = "UTC"

INSTALLED_APPS = []

MIDDLEWARE = []

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


actual_host = str(
    os.environ.get("ROUTING_E2E_HOST")
    or ""
).strip()

actual_port = str(
    os.environ.get("ROUTING_E2E_PORT")
    or ""
).strip()

actual_name = str(
    os.environ.get("ROUTING_E2E_NAME")
    or ""
).strip()

actual_user = str(
    os.environ.get("ROUTING_E2E_USER")
    or ""
).strip()

actual_password = str(
    os.environ.get("ROUTING_E2E_PASSWORD")
    or ""
)


if actual_host != EXPECTED_ROUTING_HOST:
    raise RuntimeError(
        "BLOCK13 E2E SAFETY: unexpected routing host. "
        f"Expected {EXPECTED_ROUTING_HOST!r}, "
        f"received {actual_host!r}."
    )

if actual_port != EXPECTED_ROUTING_PORT:
    raise RuntimeError(
        "BLOCK13 E2E SAFETY: unexpected routing port. "
        f"Expected {EXPECTED_ROUTING_PORT!r}, "
        f"received {actual_port!r}."
    )

if actual_name != EXPECTED_ROUTING_NAME:
    raise RuntimeError(
        "BLOCK13 E2E SAFETY: unexpected routing database. "
        f"Expected {EXPECTED_ROUTING_NAME!r}, "
        f"received {actual_name!r}."
    )

if actual_user != EXPECTED_ROUTING_USER:
    raise RuntimeError(
        "BLOCK13 E2E SAFETY: unexpected routing user. "
        f"Expected {EXPECTED_ROUTING_USER!r}, "
        f"received {actual_user!r}."
    )


DATABASES = {
    # Deliberately prevents accidental access to the ordinary
    # Adresse GN application database during this E2E.
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    },

    "routing": {
        "ENGINE": "django.db.backends.postgresql",

        "NAME": actual_name,

        "USER": actual_user,

        "PASSWORD": actual_password,

        "HOST": actual_host,

        "PORT": actual_port,

        "CONN_MAX_AGE": 0,

        "CONN_HEALTH_CHECKS": True,

        "OPTIONS": {
            "sslmode": "disable",

            "options": (
                "-c default_transaction_read_only=on"
            ),
        },
    },
}