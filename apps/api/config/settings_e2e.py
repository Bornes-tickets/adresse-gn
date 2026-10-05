"""
Dedicated settings for Adresse GN PostgreSQL/PostGIS E2E tests.

SAFETY CONTRACT
---------------
This module MUST only connect to the dedicated local Docker database:

    host = 127.0.0.1 / localhost
    port = 55432
    db   = adresse_gn_e2e
    user = adresse_gn_e2e

It must never be used against Supabase, production, staging,
the default "postgres" database, or any remote PostgreSQL host.
"""

from .settings import *  # noqa: F401,F403

import os


EXPECTED_DB_NAME = "adresse_gn_e2e"
EXPECTED_DB_USER = "adresse_gn_e2e"
EXPECTED_DB_PORT = "55432"

ALLOWED_DB_HOSTS = {
    "127.0.0.1",
    "localhost",
}


actual_host = str(
    os.environ.get("DB_HOST") or ""
).strip()

actual_port = str(
    os.environ.get("DB_PORT") or ""
).strip()

actual_name = str(
    os.environ.get("DB_NAME") or ""
).strip()

actual_user = str(
    os.environ.get("DB_USER") or ""
).strip()


if actual_host not in ALLOWED_DB_HOSTS:
    raise RuntimeError(
        "E2E SAFETY: remote PostgreSQL host forbidden. "
        f"Received DB_HOST={actual_host!r}."
    )

if actual_port != EXPECTED_DB_PORT:
    raise RuntimeError(
        "E2E SAFETY: unexpected PostgreSQL port. "
        f"Expected {EXPECTED_DB_PORT}, "
        f"received {actual_port!r}."
    )

if actual_name != EXPECTED_DB_NAME:
    raise RuntimeError(
        "E2E SAFETY: unexpected database name. "
        f"Expected {EXPECTED_DB_NAME!r}, "
        f"received {actual_name!r}."
    )

if actual_user != EXPECTED_DB_USER:
    raise RuntimeError(
        "E2E SAFETY: unexpected database user. "
        f"Expected {EXPECTED_DB_USER!r}, "
        f"received {actual_user!r}."
    )

if actual_name in {
    "postgres",
    "template0",
    "template1",
}:
    raise RuntimeError(
        "E2E SAFETY: PostgreSQL system/default "
        "database is forbidden."
    )


DATABASES["default"]["HOST"] = actual_host
DATABASES["default"]["PORT"] = actual_port
DATABASES["default"]["NAME"] = actual_name
DATABASES["default"]["USER"] = actual_user

# Local Docker does not use the production Supabase SSL requirement.
DATABASES["default"]["OPTIONS"] = {}

# Avoid keeping connections alive between E2E runs.
DATABASES["default"]["CONN_MAX_AGE"] = 0
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True
