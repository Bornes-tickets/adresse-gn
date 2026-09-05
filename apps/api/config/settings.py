from pathlib import Path

import environ


# ============================================================
# BASE
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent


# ============================================================
# ENVIRONMENT
# ============================================================

env = environ.Env(
    DEBUG=(bool, True),
)

# Charge apps/api/.env
environ.Env.read_env(BASE_DIR / ".env")


# ============================================================
# SECURITY
# ============================================================

SECRET_KEY = env("DJANGO_SECRET_KEY")

DEBUG = env.bool(
    "DEBUG",
    default=True,
)

ALLOWED_HOSTS = env.list(
    "ALLOWED_HOSTS",
    default=[
        "localhost",
        "127.0.0.1",
    ],
)


# ============================================================
# SUPABASE AUTH
# ============================================================

SUPABASE_URL = (
    env("SUPABASE_URL")
    .rstrip("/")
)

SUPABASE_PUBLISHABLE_KEY = env(
    "SUPABASE_PUBLISHABLE_KEY"
)

SUPABASE_JWT_ISSUER = (
    f"{SUPABASE_URL}/auth/v1"
)

SUPABASE_JWKS_URL = (
    f"{SUPABASE_URL}"
    "/auth/v1/.well-known/jwks.json"
)

SUPABASE_JWT_AUDIENCE = env(
    "SUPABASE_JWT_AUDIENCE",
    default="authenticated",
)


# ============================================================
# APPLICATIONS
# ============================================================

INSTALLED_APPS = [
    # Django
    "django.contrib.staticfiles",

    # Third-party
    "corsheaders",
    "rest_framework",
    "drf_spectacular",

    # Adresse GN
    "addresses",
]


# ============================================================
# MIDDLEWARE
# ============================================================

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",

    # CORS doit être placé avant CommonMiddleware
    "corsheaders.middleware.CorsMiddleware",

    "django.middleware.common.CommonMiddleware",
]


# ============================================================
# URL / WSGI
# ============================================================

ROOT_URLCONF = "config.urls"

WSGI_APPLICATION = "config.wsgi.application"


# ============================================================
# TEMPLATES
# Nécessaire notamment pour l'interface Swagger / drf-spectacular
# ============================================================

TEMPLATES = [
    {
        "BACKEND": (
            "django.template.backends.django.DjangoTemplates"
        ),
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [],
        },
    },
]


# ============================================================
# DATABASE
# Supabase PostgreSQL — Session Pooler
# ============================================================

DATABASES = {
    "default": {
        "ENGINE": (
            "django.db.backends.postgresql"
        ),

        "NAME": env(
            "DB_NAME",
            default="postgres",
        ),

        "USER": env("DB_USER"),

        "PASSWORD": env(
            "DB_PASSWORD"
        ),

        "HOST": env("DB_HOST"),

        "PORT": env(
            "DB_PORT",
            default="5432",
        ),

        # Réutilisation des connexions côté Django.
        "CONN_MAX_AGE": 60,

        # Vérifie qu'une connexion persistante reste utilisable.
        "CONN_HEALTH_CHECKS": True,

        # Supabase PostgreSQL requiert SSL.
        "OPTIONS": {
            "sslmode": "require",
        },
    }
}


# ============================================================
# INTERNATIONALISATION
# ============================================================

LANGUAGE_CODE = "fr-fr"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# ============================================================
# STATIC
# ============================================================

STATIC_URL = "static/"

STATIC_ROOT = (
    BASE_DIR / "staticfiles"
)


# ============================================================
# DEFAULT PRIMARY KEY
# ============================================================

DEFAULT_AUTO_FIELD = (
    "django.db.models.BigAutoField"
)


# ============================================================
# CORS
# Next.js local → Django local
# ============================================================

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


# ============================================================
# DJANGO REST FRAMEWORK
# ============================================================

REST_FRAMEWORK = {
    # Supabase Auth reste la source d'identité.
    "DEFAULT_AUTHENTICATION_CLASSES": [
        (
            "config.authentication."
            "SupabaseJWTAuthentication"
        ),
    ],

    # Les permissions restent définies vue par vue
    # pendant la migration progressive.
    "DEFAULT_PERMISSION_CLASSES": [],

    # Pas de modèle User Django.
    "UNAUTHENTICATED_USER": None,

    # Génération OpenAPI / Swagger
    "DEFAULT_SCHEMA_CLASS": (
        "drf_spectacular.openapi.AutoSchema"
    ),
}


# ============================================================
# OPENAPI / SWAGGER
# ============================================================

SPECTACULAR_SETTINGS = {
    "TITLE": "Adresse GN API",

    "DESCRIPTION": (
        "API métier Adresse GN : recherche d'adresses, "
        "géolocalisation, commandes, installations et "
        "intégrations partenaires."
    ),

    "VERSION": "1.0.0",

    "SERVE_INCLUDE_SCHEMA": False,
}
