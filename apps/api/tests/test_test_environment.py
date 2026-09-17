from django.conf import settings
from django.test import SimpleTestCase


class TestEnvironmentIsolationTests(SimpleTestCase):
    def test_database_is_in_memory_sqlite(self):
        database = settings.DATABASES["default"]

        self.assertEqual(
            database["ENGINE"],
            "django.db.backends.sqlite3",
        )
        self.assertEqual(
            database["NAME"],
            ":memory:",
        )

    def test_supabase_endpoint_is_test_only(self):
        self.assertEqual(
            settings.SUPABASE_URL,
            "https://adresse-gn-tests.invalid",
        )
