from django.test import SimpleTestCase

from .viago_surface import classify, surface_summary


class FakeCursor:
    def __init__(self, rows): self.rows = rows
    def __enter__(self): return self
    def __exit__(self, *a): return False
    def execute(self, sql, params): self.params = params
    def fetchall(self): return self.rows


class FakeConn:
    def __init__(self, rows): self.rows = rows
    def cursor(self): return FakeCursor(self.rows)


class ViagoSurfaceTests(SimpleTestCase):
    def test_classify(self):
        self.assertEqual(classify("residential", "dirt", None, None, None), "unpaved")
        self.assertEqual(classify("trunk", "asphalt", None, None, None), "paved")
        self.assertEqual(classify("trunk", "asphalt", None, "very_bad", None), "rough")
        self.assertEqual(classify("track", None, None, None, None), "probable_unpaved")
        self.assertEqual(classify("primary", None, None, None, None), "unknown")

    def test_sections_merge_and_unknown_is_not_paved(self):
        rows = [(1, "residential", "dirt", None, None, None),
                (2, "track", None, None, None, None),
                (3, "primary", None, None, None, None),
                (4, "trunk", "asphalt", None, None, None)]
        portions = [(2, 0, 1), (4, 0, 1), (6, 0, 1), (8, 0, 1)]  # edges 1..4
        out = surface_summary(portions=portions, lengths=[100, 50, 200, 300],
                              db_connection=FakeConn(rows))
        self.assertEqual(out["summary"]["unpaved"], 100.0)
        self.assertEqual(out["summary"]["probable_unpaved"], 50.0)
        self.assertEqual(out["summary"]["unknown"], 200.0)
        self.assertEqual(out["summary"]["paved"], 300.0)
        self.assertEqual([s["kind"] for s in out["sections"]], ["unpaved", "probable_unpaved"])
