-- R9-P5-PROD-P1 — MANUFACTURING PDF FOUNDATION
-- ADDITIVE SOURCE ONLY. NO BACKFILL. NO BEACON/QR/NUMBER MUTATION.
-- National numbering state is not referenced or consumed by this migration.

BEGIN;

DO $pre$
BEGIN
    IF to_regclass('public.beacon_manufacturing_templates') IS NOT NULL
       OR to_regclass('public.lot_manufacturing_documents') IS NOT NULL THEN
        RAISE EXCEPTION 'PROD-P1: manufacturing foundation already exists';
    END IF;

    IF to_regclass('public.lots') IS NULL
       OR to_regclass('public.beacons') IS NULL
       OR to_regclass('public.beacon_categories') IS NULL
       OR to_regclass('public.profiles') IS NULL THEN
        RAISE EXCEPTION 'PROD-P1: dependency table missing';
    END IF;

    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'manufacturing-pdfs') THEN
        RAISE EXCEPTION 'PROD-P1: manufacturing-pdfs bucket already exists';
    END IF;
END
$pre$;

CREATE TABLE public.beacon_manufacturing_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category text NOT NULL REFERENCES public.beacon_categories(code),

    CONSTRAINT beacon_manufacturing_templates_physical_category_check
        CHECK (
            category IN (
                'residential',
                'residential_plus',
                'professional',
                'institutional',
                'custom'
            )
        ),
    version integer NOT NULL CHECK (version > 0),
    name text NOT NULL,
    width_mm numeric(10,2),
    height_mm numeric(10,2),
    material text,
    finish text,
    artwork_spec jsonb NOT NULL DEFAULT '{}'::jsonb,
    active boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    UNIQUE (category, version),
    CHECK ((width_mm IS NULL OR width_mm > 0) AND (height_mm IS NULL OR height_mm > 0)),
    CHECK (
        active IS FALSE OR (
            width_mm IS NOT NULL
            AND height_mm IS NOT NULL
            AND NULLIF(BTRIM(material), '') IS NOT NULL
            AND NULLIF(BTRIM(finish), '') IS NOT NULL
            AND artwork_spec <> '{}'::jsonb
        )
    )
);

CREATE UNIQUE INDEX beacon_manufacturing_templates_one_active_per_category_uidx
ON public.beacon_manufacturing_templates(category)
WHERE active IS TRUE;

CREATE TABLE public.lot_manufacturing_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id uuid NOT NULL UNIQUE REFERENCES public.lots(id),
    category text NOT NULL REFERENCES public.beacon_categories(code),

    CONSTRAINT lot_manufacturing_documents_physical_category_check
        CHECK (
            category IN (
                'residential',
                'residential_plus',
                'professional',
                'institutional',
                'custom'
            )
        ),
    template_id uuid NOT NULL REFERENCES public.beacon_manufacturing_templates(id),
    template_version integer NOT NULL CHECK (template_version > 0),
    template_snapshot jsonb NOT NULL CHECK (
        jsonb_typeof(template_snapshot) = 'object'
        AND template_snapshot <> '{}'::jsonb
    ),
    pdf_storage_path text NOT NULL UNIQUE,
    pdf_sha256 text NOT NULL CHECK (pdf_sha256 ~ '^[0-9a-f]{64}$'),
    beacon_count integer NOT NULL CHECK (beacon_count > 0),
    number_format_version text NOT NULL DEFAULT 'v1-display-1'
        CHECK (number_format_version = 'v1-display-1'),
    generated_at timestamptz NOT NULL DEFAULT now(),
    generated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE OR REPLACE FUNCTION public.prod_p1_guard_manufacturing_template_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
    referenced boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM public.lot_manufacturing_documents d
        WHERE d.template_id = OLD.id
    )
    INTO referenced;

    IF TG_OP = 'DELETE' THEN
        IF referenced THEN
            RAISE EXCEPTION
                'PROD-P1: referenced manufacturing template cannot be deleted';
        END IF;

        RETURN OLD;
    END IF;

    IF referenced
       AND (
            NEW.id IS DISTINCT FROM OLD.id
            OR NEW.category IS DISTINCT FROM OLD.category
            OR NEW.version IS DISTINCT FROM OLD.version
            OR NEW.name IS DISTINCT FROM OLD.name
            OR NEW.width_mm IS DISTINCT FROM OLD.width_mm
            OR NEW.height_mm IS DISTINCT FROM OLD.height_mm
            OR NEW.material IS DISTINCT FROM OLD.material
            OR NEW.finish IS DISTINCT FROM OLD.finish
            OR NEW.artwork_spec IS DISTINCT FROM OLD.artwork_spec
            OR NEW.created_at IS DISTINCT FROM OLD.created_at
            OR NEW.created_by IS DISTINCT FROM OLD.created_by
       ) THEN
        RAISE EXCEPTION
            'PROD-P1: referenced template content is immutable';
    END IF;

    -- active may change so an old version can be retired without
    -- altering the versioned physical specification already used.
    RETURN NEW;
END
$fn$;


CREATE TRIGGER trg_prod_p1_guard_manufacturing_template_mutation
BEFORE UPDATE OR DELETE
ON public.beacon_manufacturing_templates
FOR EACH ROW
EXECUTE FUNCTION public.prod_p1_guard_manufacturing_template_mutation();


CREATE OR REPLACE FUNCTION public.prod_p1_validate_manufacturing_document()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
    lot_category text;
    lot_quantity integer;
    template_category text;
    frozen_version integer;
    template_name text;
    template_width_mm numeric(10, 2);
    template_height_mm numeric(10, 2);
    template_material text;
    template_finish text;
    template_artwork_spec jsonb;
    template_active boolean;
    expected_snapshot jsonb;
BEGIN
    SELECT category, quantity INTO lot_category, lot_quantity
    FROM public.lots WHERE id = NEW.lot_id;
    SELECT
        category,
        version,
        name,
        width_mm,
        height_mm,
        material,
        finish,
        artwork_spec,
        active
    INTO
        template_category,
        frozen_version,
        template_name,
        template_width_mm,
        template_height_mm,
        template_material,
        template_finish,
        template_artwork_spec,
        template_active
    FROM public.beacon_manufacturing_templates
    WHERE id = NEW.template_id
    FOR SHARE;
    IF lot_category IS NULL OR template_category IS NULL THEN
        RAISE EXCEPTION 'PROD-P1: lot/template missing';
    END IF;
    IF NEW.category <> lot_category OR NEW.category <> template_category THEN
        RAISE EXCEPTION 'PROD-P1: lot/template/document category mismatch';
    END IF;
    IF NEW.template_version <> frozen_version THEN
        RAISE EXCEPTION
            'PROD-P1: frozen template version mismatch';
    END IF;

    IF template_active IS NOT TRUE THEN
        RAISE EXCEPTION
            'PROD-P1: manufacturing document requires an active template';
    END IF;

    -- Exact versioned-template snapshot contract:
    -- template_id
    -- category
    -- version
    -- name
    -- width_mm
    -- height_mm
    -- material
    -- finish
    -- artwork_spec
    expected_snapshot := jsonb_build_object(
        'template_id',
        NEW.template_id::text,
        'category',
        template_category,
        'version',
        frozen_version,
        'name',
        template_name,
        'width_mm',
        template_width_mm::text,
        'height_mm',
        template_height_mm::text,
        'material',
        template_material,
        'finish',
        template_finish,
        'artwork_spec',
        template_artwork_spec
    );

    IF NEW.template_snapshot IS DISTINCT FROM expected_snapshot THEN
        RAISE EXCEPTION
            'PROD-P1: template snapshot does not exactly match referenced template';
    END IF;
    IF NEW.beacon_count <> lot_quantity THEN
        RAISE EXCEPTION 'PROD-P1: beacon_count must equal lot quantity';
    END IF;
    IF (SELECT COUNT(*) FROM public.beacons WHERE lot_id = NEW.lot_id) <> lot_quantity THEN
        RAISE EXCEPTION 'PROD-P1: lot beacon population incomplete';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.beacons
        WHERE lot_id = NEW.lot_id
          AND (
              category <> NEW.category
              OR NULLIF(BTRIM(public_number), '') IS NULL
              OR qr_token IS NULL
              OR NULLIF(BTRIM(qr_token::text), '') IS NULL
          )
    ) THEN
        RAISE EXCEPTION 'PROD-P1: incompatible/incomplete beacon identity';
    END IF;
    RETURN NEW;
END
$fn$;

CREATE TRIGGER trg_prod_p1_validate_manufacturing_document
BEFORE INSERT ON public.lot_manufacturing_documents
FOR EACH ROW EXECUTE FUNCTION public.prod_p1_validate_manufacturing_document();

CREATE OR REPLACE FUNCTION public.prod_p1_forbid_manufacturing_document_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
    RAISE EXCEPTION 'PROD-P1: official manufacturing documents are immutable';
END
$fn$;

CREATE TRIGGER trg_prod_p1_immutable_manufacturing_document
BEFORE UPDATE OR DELETE ON public.lot_manufacturing_documents
FOR EACH ROW EXECUTE FUNCTION public.prod_p1_forbid_manufacturing_document_mutation();

INSERT INTO storage.buckets (
    id, name, public, file_size_limit, allowed_mime_types
) VALUES (
    'manufacturing-pdfs',
    'manufacturing-pdfs',
    false,
    26214400,
    ARRAY['application/pdf']::text[]
);

ALTER TABLE public.beacon_manufacturing_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lot_manufacturing_documents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
    public.beacon_manufacturing_templates,
    public.lot_manufacturing_documents
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
    public.beacon_manufacturing_templates,
    public.lot_manufacturing_documents
TO authenticated;

GRANT ALL ON TABLE
    public.beacon_manufacturing_templates,
    public.lot_manufacturing_documents
TO service_role;

CREATE POLICY beacon_manufacturing_templates_read
ON public.beacon_manufacturing_templates
FOR SELECT TO authenticated
USING (private.current_role_is(ARRAY['ops'::text,'admin'::text,'super_admin'::text]));

CREATE POLICY lot_manufacturing_documents_read
ON public.lot_manufacturing_documents
FOR SELECT TO authenticated
USING (private.current_role_is(ARRAY['ops'::text,'admin'::text,'super_admin'::text]));

DO $post$
DECLARE
    template_rows bigint;
    document_rows bigint;
    bucket_public boolean;
BEGIN
    SELECT COUNT(*) INTO template_rows FROM public.beacon_manufacturing_templates;
    SELECT COUNT(*) INTO document_rows FROM public.lot_manufacturing_documents;
    IF template_rows <> 0 OR document_rows <> 0 THEN
        RAISE EXCEPTION 'PROD-P1: foundation must not seed rows';
    END IF;

    SELECT public INTO bucket_public
    FROM storage.buckets WHERE id = 'manufacturing-pdfs';
    IF bucket_public IS DISTINCT FROM false THEN
        RAISE EXCEPTION 'PROD-P1: bucket must be private';
    END IF;
END
$post$;

COMMIT;
