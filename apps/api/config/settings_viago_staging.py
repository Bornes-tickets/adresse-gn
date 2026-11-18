"""VIAGO G1-P6-P3C-P4: isolated staging, never the local VIAGO lab.

Choose this module explicitly with DJANGO_SETTINGS_MODULE=config.settings_viago_staging.
It leaves config.settings and config.settings_viago_local unchanged.
No database provisioning or migrations are performed here.
"""
from __future__ import annotations

import os
import re

from django.core.exceptions import ImproperlyConfigured

from .settings import *  # noqa: F401,F403 - deliberately extends existing settings


def _required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ImproperlyConfigured(f"VIAGO staging requires {name}; value is never logged")
    return value


if os.environ.get("VIAGO_STAGING_ENABLED") != "1":
    raise ImproperlyConfigured("VIAGO staging must be explicitly enabled")

if os.environ.get("VIAGO_ROUTING_READONLY_ROLE_VERIFIED") != "1":
    raise ImproperlyConfigured("VIAGO staging needs an independently verified read-only DB role")

DEBUG = False
ROOT_URLCONF = "config.urls_viago_staging"

hostnames = _required("VIAGO_STAGING_ALLOWED_HOSTS")
ALLOWED_HOSTS = [part.strip().lower() for part in hostnames.split(",") if part.strip()]
if not ALLOWED_HOSTS or any(
    not re.fullmatch(r"[a-z0-9][a-z0-9.-]*[a-z0-9]", host)
    or ".." in host
    or host.startswith(".")
    for host in ALLOWED_HOSTS
):
    raise ImproperlyConfigured("VIAGO_STAGING_ALLOWED_HOSTS requires exact DNS hostnames")

VIAGO_STAGING_BEARER_TOKEN = _required("VIAGO_STAGING_BEARER_TOKEN")
if len(VIAGO_STAGING_BEARER_TOKEN) < 48:
    raise ImproperlyConfigured("VIAGO staging bearer token must have at least 48 characters")

project_ref = _required("VIAGO_ROUTING_PROJECT_REF").lower()
if not re.fullmatch(r"[a-z0-9]{8,32}", project_ref):
    raise ImproperlyConfigured("VIAGO_ROUTING_PROJECT_REF has an invalid format")

routing_host = _required("VIAGO_ROUTING_DB_HOST").lower()
if not routing_host.endswith(".supabase.com") and not routing_host.endswith(".supabase.co"):
    raise ImproperlyConfigured("VIAGO staging DB host must be an approved Supabase host")

routing_user = _required("VIAGO_ROUTING_DB_USER")
# The dedicated role must be provisioned separately. Never connect as postgres/admin.
if routing_user != f"viago_router_ro.{project_ref}" and routing_user != "viago_router_ro":
    raise ImproperlyConfigured("VIAGO routing requires the viago_router_ro account")
if routing_host.endswith(".pooler.supabase.com") and routing_user != f"viago_router_ro.{project_ref}":
    raise ImproperlyConfigured("Session pooler requires a project-qualified routing username")

main_db = DATABASES.get("default", {})
main_user = str(main_db.get("USER", ""))
main_host = str(main_db.get("HOST", "")).lower()
if (
    main_user.endswith("." + project_ref)
    or main_host == f"db.{project_ref}.supabase.co"
    or main_user == routing_user
):
    raise ImproperlyConfigured("VIAGO routing project must differ from the application DB")

ca_file = _required("VIAGO_ROUTING_DB_CA_FILE")
if not os.path.isfile(ca_file):
    raise ImproperlyConfigured("VIAGO routing CA certificate path is not a readable file")

port_str = _required("VIAGO_ROUTING_DB_PORT")
if port_str != "5432":
    raise ImproperlyConfigured("VIAGO routing staging supports direct/session port 5432 only")

# This separate staging PROCESS must not access the production Adresse GN DB,
# even if base settings provided its connection details. Production settings
# themselves are never changed; only the opt-in staging module uses a dummy default.
DATABASES = {
    "default": {"ENGINE": "django.db.backends.dummy"},
    "viago_routing": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": _required("VIAGO_ROUTING_DB_NAME"),
        "HOST": routing_host,
        "PORT": 5432,
        "USER": routing_user,
        "PASSWORD": _required("VIAGO_ROUTING_DB_PASSWORD"),
        "CONN_MAX_AGE": 0,
        "CONN_HEALTH_CHECKS": True,
        "ATOMIC_REQUESTS": False,
        "OPTIONS": {
            "sslmode": "verify-full",
            "sslrootcert": ca_file,
            "connect_timeout": 5,
            "application_name": "viago-staging-routing",
        },
    },
}

# Only exact public domains; front end communicates via its own server-side proxy.
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
# Enable HSTS after confirming correct HTTPS proxy termination and hosts.
SECURE_HSTS_SECONDS = 0

# DRF scoped throttling is defense-in-depth, not a substitute for edge rate limits.
_rest = globals().get("REST_FRAMEWORK", {})
REST_FRAMEWORK = {
    **_rest,
    "DEFAULT_THROTTLE_RATES": {
        **_rest.get("DEFAULT_THROTTLE_RATES", {}),
        "viago_staging_route": "30/min",
    },
}
