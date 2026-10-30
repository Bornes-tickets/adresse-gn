from __future__ import annotations

import re
from unittest.mock import Mock, patch
import sys
from pathlib import Path
from unittest import TestCase, main

API_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = API_ROOT.parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from backoffice.manufacturing_documents import (
    freeze_template_snapshot,
    manufacturing_beacon_identity,
    sha256_pdf,
)
from backoffice.manufacturing_runtime import (
    ManufacturingRuntimeError,
    canonical_manufacturing_qr_payload,
    render_official_manufacturing_pdf,
)




class _A2AtomicContext:
    def __init__(self):
        self.entered = 0
        self.exited = 0
        self.exited_with_exception = False

    def __enter__(self):
        self.entered += 1
        return self

    def __exit__(self, exc_type, exc, tb):
        self.exited += 1
        self.exited_with_exception = exc_type is not None
        return False


class _A2Transaction:
    def __init__(self, atomic_context):
        self.atomic_context = atomic_context

    def atomic(self):
        return self.atomic_context


class _A2Cursor:
    def __init__(
        self,
        *,
        lot,
        existing=None,
        templates=None,
        beacons=None,
        insert_error=None,
        events=None,
    ):
        self.lot = lot
        self.existing = existing
        self.templates = list(templates or [])
        self.beacons = list(beacons or [])
        self.insert_error = insert_error
        self.events = events if events is not None else []
        self.queries = []
        self._one = None
        self._all = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, sql, params=None):
        normalized = " ".join(str(sql).lower().split())
        self.queries.append((normalized, list(params or [])))
        self._one = None
        self._all = []

        if "from public.lots" in normalized:
            self._one = self.lot
            return
        if "from public.lot_manufacturing_documents" in normalized:
            self._one = self.existing
            return
        if "from public.beacon_manufacturing_templates" in normalized:
            self._all = list(self.templates)
            return
        if "from public.beacons" in normalized:
            self._all = list(self.beacons)
            return
        if "insert into public.lot_manufacturing_documents" in normalized:
            self.events.append("insert")
            if self.insert_error is not None:
                raise self.insert_error
            self._one = ("123e4567-e89b-12d3-a456-426614174099",)
            return

        raise AssertionError(f"Unexpected SQL in A2 fake cursor: {normalized}")

    def fetchone(self):
        return self._one

    def fetchall(self):
        return list(self._all)


class _A2Connection:
    def __init__(self, cursor):
        self._cursor = cursor

    def cursor(self):
        return self._cursor


class ProdP2ManufacturingRuntimeTests(TestCase):
    def snapshot(self):
        return freeze_template_snapshot(
            template_id="123e4567-e89b-12d3-a456-426614174001",
            category="residential",
            version=1,
            name="TEST MODEL",
            width_mm="200",
            height_mm="150",
            material="TEST-ONLY",
            finish="TEST-ONLY",
            artwork_spec={
                "supplier_pdf": {
                    "background_hex": "#FFFFFF",
                    "border_hex": "#111827",
                    "text_hex": "#111827",
                    "accent_hex": "#2563EB",
                    "qr_position": "right",
                    "number_position": "bottom",
                    "label": "Adresse GN TEST",
                },
                "test_only": True,
            },
        )

    def identities(self):
        return [
            manufacturing_beacon_identity(
                public_number="CKY03-582741444",
                qr_token="26fa7253-ae0a-4738-a71a-ec6b6061045c",
                category="residential",
            ),
            manufacturing_beacon_identity(
                public_number="CKY03-582741459",
                qr_token="c4ca7437-1bd9-455a-b442-7f75b535348a",
                category="residential",
            ),
        ]

    def test_qr_payload_preserves_v1_number_and_token(self):
        identity = self.identities()[0]
        payload = canonical_manufacturing_qr_payload(
            site_origin="https://adresse-gn.example",
            identity=identity,
        )
        self.assertEqual(
            payload,
            (
                "https://adresse-gn.example/"
                "a/CKY03-582741444"
                "?qr=26fa7253-ae0a-4738-a71a-ec6b6061045c"
            ),
        )
        match = re.search(
            r"(?:[A-Z]{3}\d{2}-\d{9}|[A-Z]{3}\d{2}\d{9})",
            payload.upper(),
        )
        self.assertIsNotNone(match)
        self.assertEqual(match.group(0), "CKY03-582741444")

    def test_local_origin_rejected(self):
        with self.assertRaises(ManufacturingRuntimeError):
            canonical_manufacturing_qr_payload(
                site_origin="http://localhost:3000",
                identity=self.identities()[0],
            )

    def test_renderer_is_in_memory_and_deterministic(self):
        kwargs = {
            "lot_code": "AGN-CKY03-TEST",
            "category": "residential",
            "quantity": 2,
            "template_snapshot": self.snapshot(),
            "identities": self.identities(),
            "site_origin": "https://adresse-gn.example",
        }
        first = render_official_manufacturing_pdf(**kwargs)
        second = render_official_manufacturing_pdf(**kwargs)
        self.assertTrue(first.startswith(b"%PDF"))
        self.assertEqual(sha256_pdf(first), sha256_pdf(second))
        self.assertGreater(len(first), 1000)

    def test_renderer_requires_explicit_supplier_pdf_style(self):
        snapshot = freeze_template_snapshot(
            template_id="123e4567-e89b-12d3-a456-426614174001",
            category="residential",
            version=1,
            name="TEST MODEL",
            width_mm="200",
            height_mm="150",
            material="TEST-ONLY",
            finish="TEST-ONLY",
            artwork_spec={"test_only": True},
        )
        with self.assertRaises(ManufacturingRuntimeError):
            render_official_manufacturing_pdf(
                lot_code="AGN-CKY03-TEST",
                category="residential",
                quantity=2,
                template_snapshot=snapshot,
                identities=self.identities(),
                site_origin="https://adresse-gn.example",
            )

    def test_runtime_never_allocates_or_mutates_beacon_identity(self):
        source = (
            API_ROOT
            / "backoffice/manufacturing_runtime.py"
        ).read_text(encoding="utf-8").lower()

        for forbidden in [
            "next_v1_beacon_number",
            "address_national_id_seq",
            "update public.beacons",
            "delete from public.beacons",
            "insert into public.beacons",
            "update public.lots",
            "delete from public.lots",
            "insert into public.lots",
        ]:
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, source)

        for required in [
            "numbering_version",
            "qr_token::text",
            "upload_storage_object",
            "signed_storage_url",
            "lot_manufacturing_documents",
            "beacon_manufacturing_templates",
            'source="existing"',
            'source="created"',
        ]:
            with self.subTest(required=required):
                self.assertIn(required, source)

    def test_storage_upload_helper_is_non_upsert(self):
        source = (
            API_ROOT
            / "backoffice/external_supabase.py"
        ).read_text(encoding="utf-8")
        self.assertIn(
            'headers["x-upsert"] = "false"',
            source,
        )

    def test_admin_action_and_ui_are_wired(self):
        catalog = (
            API_ROOT
            / "backoffice/action_catalog.py"
        ).read_text(encoding="utf-8")
        actions = (
            API_ROOT
            / "backoffice/global_actions.py"
        ).read_text(encoding="utf-8")
        ui = (
            REPO_ROOT
            / "apps/web/src/features/backoffice/components/admin-beacons-page.tsx"
        ).read_text(encoding="utf-8")

        self.assertIn('"manufacturing_pdf"', catalog)
        self.assertIn('"PDF fournisseur officiel"', catalog)
        self.assertIn(
            "get_or_create_official_manufacturing_pdf",
            actions,
        )
        self.assertIn('"manufacturing_pdf"', actions)
        self.assertIn('"manufacturing_pdf"', ui)
        self.assertIn("PDF fournisseur", ui)
        self.assertIn("lastGeneratedLot", ui)
        self.assertIn("onManufacturingPdf", ui)


    def _a2_runtime_module(self):
        return __import__(
            render_official_manufacturing_pdf.__module__,
            fromlist=["*"],
        )

    def _a2_template_row(self):
        return (
            "123e4567-e89b-12d3-a456-426614174001",
            "residential",
            1,
            "TEST MODEL",
            "200",
            "150",
            "TEST-ONLY",
            "TEST-ONLY",
            {
                "supplier_pdf": {
                    "background_hex": "#FFFFFF",
                    "border_hex": "#111827",
                    "text_hex": "#111827",
                    "accent_hex": "#2563EB",
                    "qr_position": "right",
                    "number_position": "bottom",
                    "label": "Adresse GN TEST",
                },
                "test_only": True,
            },
        )

    def _a2_beacon_rows(self):
        return [
            (
                "CKY03-582741444",
                "26fa7253-ae0a-4738-a71a-ec6b6061045c",
                "residential",
                "v1",
            ),
            (
                "CKY03-582741459",
                "c4ca7437-1bd9-455a-b442-7f75b535348a",
                "residential",
                "v1",
            ),
        ]

    def _a2_cursor(
        self,
        *,
        existing=None,
        templates=None,
        insert_error=None,
        events=None,
    ):
        return _A2Cursor(
            lot=(
                "123e4567-e89b-12d3-a456-426614174010",
                "AGN-CKY03-TEST",
                2,
                "residential",
                "generated",
            ),
            existing=existing,
            templates=(
                [self._a2_template_row()]
                if templates is None
                else templates
            ),
            beacons=self._a2_beacon_rows(),
            insert_error=insert_error,
            events=events,
        )

    def test_get_or_create_existing_document_skips_regeneration(self):
        runtime = self._a2_runtime_module()
        lot_id = "123e4567-e89b-12d3-a456-426614174010"
        storage_path = runtime.manufacturing_pdf_storage_path(lot_id=lot_id)
        existing_hash = "a" * 64
        cursor = self._a2_cursor(
            existing=(
                "123e4567-e89b-12d3-a456-426614174099",
                "residential",
                storage_path,
                existing_hash,
                2,
                "123e4567-e89b-12d3-a456-426614174001",
                1,
                runtime.NUMBER_FORMAT_VERSION,
            )
        )
        atomic = _A2AtomicContext()
        render_mock = Mock()
        sha_mock = Mock()
        upload_mock = Mock()
        delete_mock = Mock()

        with (
            patch.object(runtime, "connection", _A2Connection(cursor)),
            patch.object(runtime, "transaction", _A2Transaction(atomic)),
            patch.object(runtime, "render_official_manufacturing_pdf", render_mock),
            patch.object(runtime, "sha256_pdf", sha_mock),
            patch.object(runtime, "upload_storage_object", upload_mock),
            patch.object(runtime, "delete_storage_object", delete_mock),
            patch.object(
                runtime,
                "signed_storage_url",
                return_value="https://signed.example/original",
            ),
        ):
            result = runtime.get_or_create_official_manufacturing_pdf(
                actor_id="123e4567-e89b-12d3-a456-426614174020",
                lot_id=lot_id,
            )

        self.assertEqual(result["source"], "existing")
        self.assertEqual(result["storage_path"], storage_path)
        self.assertEqual(result["pdf_sha256"], existing_hash)
        render_mock.assert_not_called()
        sha_mock.assert_not_called()
        upload_mock.assert_not_called()
        delete_mock.assert_not_called()
        self.assertFalse(
            any(
                "insert into public.lot_manufacturing_documents" in sql
                for sql, _ in cursor.queries
            )
        )

    def test_get_or_create_first_generation_order_and_identity_preservation(self):
        runtime = self._a2_runtime_module()
        events = []
        cursor = self._a2_cursor(events=events)
        atomic = _A2AtomicContext()
        pdf_bytes = b"%PDF-A2-DETERMINISTIC"
        pdf_hash = "b" * 64
        render_mock = Mock(return_value=pdf_bytes)
        sha_mock = Mock(return_value=pdf_hash)

        def upload_side_effect(**kwargs):
            events.append("upload")
            self.assertEqual(kwargs["content"], pdf_bytes)

        upload_mock = Mock(side_effect=upload_side_effect)
        delete_mock = Mock()

        with (
            patch.object(runtime, "connection", _A2Connection(cursor)),
            patch.object(runtime, "transaction", _A2Transaction(atomic)),
            patch.object(
                runtime,
                "public_site_url",
                return_value="https://adresse-gn.example",
            ),
            patch.object(runtime, "render_official_manufacturing_pdf", render_mock),
            patch.object(runtime, "sha256_pdf", sha_mock),
            patch.object(runtime, "upload_storage_object", upload_mock),
            patch.object(runtime, "delete_storage_object", delete_mock),
            patch.object(runtime, "audit", Mock()),
            patch.object(
                runtime,
                "signed_storage_url",
                return_value="https://signed.example/created",
            ),
        ):
            result = runtime.get_or_create_official_manufacturing_pdf(
                actor_id="123e4567-e89b-12d3-a456-426614174020",
                lot_id="123e4567-e89b-12d3-a456-426614174010",
            )

        self.assertEqual(result["source"], "created")
        self.assertEqual(result["pdf_sha256"], pdf_hash)
        render_mock.assert_called_once()
        sha_mock.assert_called_once_with(pdf_bytes)
        upload_mock.assert_called_once()
        delete_mock.assert_not_called()
        self.assertEqual(events, ["upload", "insert"])

        identities = render_mock.call_args.kwargs["identities"]
        self.assertEqual(
            [identity.public_number_stored for identity in identities],
            ["CKY03-582741444", "CKY03-582741459"],
        )
        self.assertEqual(
            [identity.qr_token for identity in identities],
            [
                "26fa7253-ae0a-4738-a71a-ec6b6061045c",
                "c4ca7437-1bd9-455a-b442-7f75b535348a",
            ],
        )

        sqls = [sql for sql, _ in cursor.queries]
        lot_index = next(i for i, sql in enumerate(sqls) if "from public.lots" in sql)
        document_index = next(
            i
            for i, sql in enumerate(sqls)
            if "from public.lot_manufacturing_documents" in sql
        )
        template_sql = next(
            sql
            for sql in sqls
            if "from public.beacon_manufacturing_templates" in sql
        )
        beacon_sql = next(sql for sql in sqls if "from public.beacons" in sql)
        self.assertLess(lot_index, document_index)
        self.assertIn("for update", sqls[lot_index])
        self.assertIn("category = %s", template_sql)
        self.assertIn("active is true", template_sql)
        self.assertIn("numbering_version", beacon_sql)
        self.assertEqual(atomic.entered, 1)
        self.assertEqual(atomic.exited, 1)
        self.assertFalse(atomic.exited_with_exception)

    def test_get_or_create_rejects_zero_or_multiple_active_templates(self):
        runtime = self._a2_runtime_module()

        for templates in (
            [],
            [self._a2_template_row(), self._a2_template_row()],
        ):
            with self.subTest(template_count=len(templates)):
                cursor = self._a2_cursor(templates=templates)
                atomic = _A2AtomicContext()
                render_mock = Mock()
                upload_mock = Mock()
                delete_mock = Mock()

                with (
                    patch.object(runtime, "connection", _A2Connection(cursor)),
                    patch.object(runtime, "transaction", _A2Transaction(atomic)),
                    patch.object(
                        runtime,
                        "render_official_manufacturing_pdf",
                        render_mock,
                    ),
                    patch.object(runtime, "upload_storage_object", upload_mock),
                    patch.object(runtime, "delete_storage_object", delete_mock),
                ):
                    with self.assertRaises(ManufacturingRuntimeError) as raised:
                        runtime.get_or_create_official_manufacturing_pdf(
                            actor_id="123e4567-e89b-12d3-a456-426614174020",
                            lot_id="123e4567-e89b-12d3-a456-426614174010",
                        )

                self.assertEqual(raised.exception.status, "template_missing")
                render_mock.assert_not_called()
                upload_mock.assert_not_called()
                delete_mock.assert_not_called()

    def test_storage_failure_before_success_never_inserts_or_compensates(self):
        runtime = self._a2_runtime_module()
        events = []
        cursor = self._a2_cursor(events=events)
        atomic = _A2AtomicContext()
        delete_mock = Mock()

        with (
            patch.object(runtime, "connection", _A2Connection(cursor)),
            patch.object(runtime, "transaction", _A2Transaction(atomic)),
            patch.object(
                runtime,
                "public_site_url",
                return_value="https://adresse-gn.example",
            ),
            patch.object(
                runtime,
                "render_official_manufacturing_pdf",
                return_value=b"%PDF-A2-STORAGE-FAIL",
            ),
            patch.object(runtime, "sha256_pdf", return_value="c" * 64),
            patch.object(
                runtime,
                "upload_storage_object",
                side_effect=runtime.SupabaseExternalError(
                    "storage unavailable"
                ),
            ),
            patch.object(runtime, "delete_storage_object", delete_mock),
            patch.object(runtime, "audit", Mock()),
        ):
            with self.assertRaises(ManufacturingRuntimeError) as raised:
                runtime.get_or_create_official_manufacturing_pdf(
                    actor_id="123e4567-e89b-12d3-a456-426614174020",
                    lot_id="123e4567-e89b-12d3-a456-426614174010",
                )

        self.assertEqual(raised.exception.status, "external_error")
        delete_mock.assert_not_called()
        self.assertNotIn("insert", events)
        self.assertFalse(
            any(
                "insert into public.lot_manufacturing_documents" in sql
                for sql, _ in cursor.queries
            )
        )

    def test_db_failure_after_upload_compensates_exactly_once(self):
        runtime = self._a2_runtime_module()
        events = []
        cursor = self._a2_cursor(
            insert_error=RuntimeError("db insert failed"),
            events=events,
        )
        atomic = _A2AtomicContext()
        delete_mock = Mock()

        def upload_side_effect(**kwargs):
            events.append("upload")

        with (
            patch.object(runtime, "connection", _A2Connection(cursor)),
            patch.object(runtime, "transaction", _A2Transaction(atomic)),
            patch.object(
                runtime,
                "public_site_url",
                return_value="https://adresse-gn.example",
            ),
            patch.object(
                runtime,
                "render_official_manufacturing_pdf",
                return_value=b"%PDF-A2-DB-FAIL",
            ),
            patch.object(runtime, "sha256_pdf", return_value="d" * 64),
            patch.object(
                runtime,
                "upload_storage_object",
                side_effect=upload_side_effect,
            ),
            patch.object(runtime, "delete_storage_object", delete_mock),
            patch.object(runtime, "audit", Mock()),
        ):
            with self.assertRaises(ManufacturingRuntimeError) as raised:
                runtime.get_or_create_official_manufacturing_pdf(
                    actor_id="123e4567-e89b-12d3-a456-426614174020",
                    lot_id="123e4567-e89b-12d3-a456-426614174010",
                )

        self.assertEqual(raised.exception.status, "generation_error")
        self.assertEqual(events, ["upload", "insert"])
        delete_mock.assert_called_once()
        self.assertTrue(atomic.exited_with_exception)

        source = (
            API_ROOT / "backoffice/manufacturing_runtime.py"
        ).read_text(encoding="utf-8").lower()
        self.assertNotIn("next_v1_beacon_number", source)
        self.assertNotIn("address_national_id_seq", source)

    def test_cleanup_failure_is_explicit_and_chained(self):
        runtime = self._a2_runtime_module()
        cursor = self._a2_cursor(
            insert_error=RuntimeError("db insert failed"),
        )
        atomic = _A2AtomicContext()
        cleanup_error = RuntimeError("cleanup failed")

        with (
            patch.object(runtime, "connection", _A2Connection(cursor)),
            patch.object(runtime, "transaction", _A2Transaction(atomic)),
            patch.object(
                runtime,
                "public_site_url",
                return_value="https://adresse-gn.example",
            ),
            patch.object(
                runtime,
                "render_official_manufacturing_pdf",
                return_value=b"%PDF-A2-CLEANUP-FAIL",
            ),
            patch.object(runtime, "sha256_pdf", return_value="e" * 64),
            patch.object(runtime, "upload_storage_object", Mock()),
            patch.object(
                runtime,
                "delete_storage_object",
                side_effect=cleanup_error,
            ) as delete_mock,
            patch.object(runtime, "audit", Mock()),
        ):
            with self.assertRaises(ManufacturingRuntimeError) as raised:
                runtime.get_or_create_official_manufacturing_pdf(
                    actor_id="123e4567-e89b-12d3-a456-426614174020",
                    lot_id="123e4567-e89b-12d3-a456-426614174010",
                )

        self.assertEqual(
            raised.exception.status,
            "storage_compensation_failed",
        )
        self.assertEqual(raised.exception.http_status, 502)
        self.assertIs(raised.exception.__cause__, cleanup_error)
        self.assertIn("orphelin", str(raised.exception).lower())
        self.assertIn(
            runtime.manufacturing_pdf_storage_path(
                lot_id="123e4567-e89b-12d3-a456-426614174010"
            ),
            str(raised.exception),
        )
        delete_mock.assert_called_once()

    def test_concurrency_and_idempotence_foundation_contract(self):
        runtime_source = (
            API_ROOT / "backoffice/manufacturing_runtime.py"
        ).read_text(encoding="utf-8").lower()
        migration_source = (
            REPO_ROOT
            / "supabase/migrations/"
            "20261029110000_r9_p5_prod_p1_manufacturing_pdf_foundation.sql"
        ).read_text(encoding="utf-8").lower()

        lot_select = runtime_source.index("from public.lots")
        document_select = runtime_source.index(
            "from public.lot_manufacturing_documents"
        )
        render_call = runtime_source.index(
            "pdf_bytes = render_official_manufacturing_pdf"
        )
        upload_call = runtime_source.index(
            "upload_storage_object(",
            render_call,
        )
        insert_call = runtime_source.index(
            "insert into public.lot_manufacturing_documents"
        )

        self.assertLess(lot_select, document_select)
        self.assertIn(
            "for update",
            runtime_source[lot_select:document_select],
        )
        self.assertLess(render_call, upload_call)
        self.assertLess(upload_call, insert_call)
        self.assertRegex(
            migration_source,
            r"lot_id\s+uuid\s+not\s+null\s+unique",
        )
        self.assertIn('source="existing"', runtime_source)
        self.assertIn('source="created"', runtime_source)
if __name__ == "__main__":
    main()
