"""
Configuration isolée pour les tests automatisés Adresse GN.
"""

SECRET_KEY = "adresse-gn-tests-only"
DEBUG = False
ALLOWED_HOSTS = ["testserver", "localhost", "127.0.0.1"]

INSTALLED_APPS = [
    "rest_framework",
]

MIDDLEWARE = []
ROOT_URLCONF = "tests.urls"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

USE_TZ = True
TIME_ZONE = "UTC"
LANGUAGE_CODE = "fr-fr"
USE_I18N = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

SUPABASE_URL = "https://adresse-gn-tests.invalid"
SUPABASE_PUBLISHABLE_KEY = "test-publishable-key"
SUPABASE_SECRET_KEY = ""
SUPABASE_SERVICE_ROLE_KEY = ""
SUPABASE_SERVER_KEY = ""
SUPABASE_JWT_ISSUER = (
    "https://adresse-gn-tests.invalid/auth/v1"
)
SUPABASE_JWKS_URL = (
    "https://adresse-gn-tests.invalid"
    "/auth/v1/.well-known/jwks.json"
)
SUPABASE_JWT_AUDIENCE = "authenticated"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "config.authentication.SupabaseJWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [],
    "UNAUTHENTICATED_USER": None,
}
