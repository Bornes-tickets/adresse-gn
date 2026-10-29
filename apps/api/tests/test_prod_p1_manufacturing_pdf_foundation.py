from __future__ import annotations

import sys
from pathlib import Path
from unittest import TestCase, main

API_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = API_ROOT.parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from numbering import NumberingError, format_v1_public_number
from backoffice.manufacturing_documents import (
    MANUFACTURING_BUCKET,
    NUMBER_FORMAT_VERSION,
    ManufacturingContractError,
    freeze_template_snapshot,
    manufacturing_beacon_identity,
    manufacturing_pdf_storage_path,
    sha256_pdf,
)

class ProdP1FoundationTests(TestCase):
    def test_display_format(self):
        self.assertEqual(format_v1_public_number("CKY03-582741444"), "CKY03-58274144-4")

    def test_wrong_check_digit_rejected(self):
        with self.assertRaises(NumberingError):
            format_v1_public_number("CKY03-582741440")

    def test_identity_preserves_storage_and_qr(self):
        item = manufacturing_beacon_identity(
            public_number="CKY03-582741444",
            qr_token="qr-fixed-001",
            category="residential",
        )
        self.assertEqual(item.public_number_stored, "CKY03-582741444")
        self.assertEqual(item.public_number_display, "CKY03-58274144-4")
        self.assertEqual(item.qr_token, "qr-fixed-001")
        self.assertEqual(item.category, "residential")

    def test_digital_only_rejected(self):
        with self.assertRaises(ManufacturingContractError):
            manufacturing_beacon_identity(
                public_number="CKY03-582741444",
                qr_token="qr-fixed",
                category="digital_only",
            )

    def test_storage_path_deterministic(self):
        lot = "123e4567-e89b-12d3-a456-426614174000"
        expected = f"lots/{lot}/official-manufacturing.pdf"
        self.assertEqual(manufacturing_pdf_storage_path(lot_id=lot), expected)
        self.assertEqual(manufacturing_pdf_storage_path(lot_id=lot), expected)

    def test_snapshot_deep_copy(self):
        artwork = {"logo": {"position": "top"}}
        snap = freeze_template_snapshot(
            template_id="template-v1",
            category="residential",
            version=1,
            name="Résidentiel Standard V1",
            width_mm="200",
            height_mm="150",
            material="TEST-ONLY",
            finish="TEST-ONLY",
            artwork_spec=artwork,
        )
        artwork["logo"]["position"] = "bottom"
        self.assertEqual(snap.artwork_spec["logo"]["position"], "top")

    def test_sha256(self):
        a = sha256_pdf(b"%PDF-test")
        b = sha256_pdf(b"%PDF-test")
        self.assertEqual(a, b)
        self.assertEqual(len(a), 64)

    def test_constants(self):
        self.assertEqual(MANUFACTURING_BUCKET, "manufacturing-pdfs")
        self.assertEqual(NUMBER_FORMAT_VERSION, "v1-display-1")

    def test_migration_has_no_number_sequence(self):
        text = (
            REPO_ROOT / "supabase/migrations/20261029110000_r9_p5_prod_p1_manufacturing_pdf_foundation.sql"
        ).read_text(encoding="utf-8").lower()
        self.assertNotIn("nextval(", text)
        self.assertNotIn("address_national_id_seq", text)

    def test_migration_foundation_tokens(self):
        text = (
            REPO_ROOT / "supabase/migrations/20261029110000_r9_p5_prod_p1_manufacturing_pdf_foundation.sql"
        ).read_text(encoding="utf-8")
        for token in [
            "CREATE TABLE public.beacon_manufacturing_templates",
            "CREATE TABLE public.lot_manufacturing_documents",
            "manufacturing-pdfs",
            "pdf_sha256",
            "template_snapshot",
            "official manufacturing documents are immutable",
        ]:
            self.assertIn(token, text)
    def test_snapshot_dimensions_are_canonical(self):
        snapshot = freeze_template_snapshot(
            template_id="template-v1",
            category="residential",
            version=1,
            name="Résidentiel Standard V1",
            width_mm="200",
            height_mm="150.5",
            material="TEST-ONLY",
            finish="TEST-ONLY",
            artwork_spec={"logo": {"position": "top"}},
        )

        self.assertEqual(
            snapshot.width_mm,
            "200.00",
        )

        self.assertEqual(
            snapshot.height_mm,
            "150.50",
        )

    def test_migration_guards_referenced_template_content(self):
        text = (
            REPO_ROOT
            / "supabase/migrations/20261029110000_r9_p5_prod_p1_manufacturing_pdf_foundation.sql"
        ).read_text(
            encoding="utf-8"
        )

        for token in [
            "trg_prod_p1_guard_manufacturing_template_mutation",
            "BEFORE UPDATE OR DELETE",
            "ON public.beacon_manufacturing_templates",
            "referenced template content is immutable",
            "referenced manufacturing template cannot be deleted",
        ]:
            with self.subTest(
                token=token
            ):
                self.assertIn(
                    token,
                    text,
                )

    def test_migration_verifies_exact_template_snapshot(self):
        text = (
            REPO_ROOT
            / "supabase/migrations/20261029110000_r9_p5_prod_p1_manufacturing_pdf_foundation.sql"
        ).read_text(
            encoding="utf-8"
        )

        for token in [
            "expected_snapshot := jsonb_build_object(",
            "'template_id'",
            "'category'",
            "'version'",
            "'name'",
            "'width_mm'",
            "'height_mm'",
            "'material'",
            "'finish'",
            "'artwork_spec'",
            "template_width_mm::text",
            "template_height_mm::text",
            "NEW.template_snapshot IS DISTINCT FROM expected_snapshot",
            "manufacturing document requires an active template",
        ]:
            with self.subTest(
                token=token
            ):
                self.assertIn(
                    token,
                    text,
                )

    def test_migration_restricts_manufacturing_to_physical_categories(self):
        text = (
            REPO_ROOT
            / "supabase/migrations/20261029110000_r9_p5_prod_p1_manufacturing_pdf_foundation.sql"
        ).read_text(
            encoding="utf-8"
        )

        template_constraint = (
            "beacon_manufacturing_templates_"
            "physical_category_check"
        )

        document_constraint = (
            "lot_manufacturing_documents_"
            "physical_category_check"
        )

        self.assertIn(
            template_constraint,
            text,
        )

        self.assertIn(
            document_constraint,
            text,
        )

        for category in [
            "residential",
            "residential_plus",
            "professional",
            "institutional",
            "custom",
        ]:
            with self.subTest(
                category=category
            ):
                self.assertGreaterEqual(
                    text.count(
                        f"'{category}'"
                    ),
                    2,
                )

        self.assertNotIn(
            "'digital_only'",
            text,
        )


if __name__ == "__main__":
    main()
