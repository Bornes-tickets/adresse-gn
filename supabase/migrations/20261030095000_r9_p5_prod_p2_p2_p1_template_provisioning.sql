-- R9-P5-PROD-P2-P2-P1 — OFFICIAL MANUFACTURING TEMPLATE PROVISIONING
-- ADDITIVE SOURCE ONLY.
-- Provisions exactly two active V1 manufacturing templates:
--   AGN-RS-V1  -> residential      -> Résidentiel Standard
--   AGN-RP-V1  -> residential_plus -> Résidentiel Premium
--
-- No lot/beacon/document/storage/numbering mutation is performed here.
-- P2-P1 runtime/foundation files are intentionally untouched.

BEGIN;

DO $pre$
DECLARE
    category_count integer;
    existing_v1_count integer;
    existing_active_count integer;
BEGIN
    IF to_regclass('public.beacon_manufacturing_templates') IS NULL
       OR to_regclass('public.beacon_categories') IS NULL THEN
        RAISE EXCEPTION
            'P2-P2-P1: manufacturing template dependencies are missing';
    END IF;

    SELECT COUNT(*)
    INTO category_count
    FROM public.beacon_categories
    WHERE code IN ('residential', 'residential_plus');

    IF category_count <> 2 THEN
        RAISE EXCEPTION
            'P2-P2-P1: required residential categories are missing';
    END IF;

    SELECT COUNT(*)
    INTO existing_v1_count
    FROM public.beacon_manufacturing_templates
    WHERE category IN ('residential', 'residential_plus')
      AND version = 1;

    IF existing_v1_count <> 0 THEN
        RAISE EXCEPTION
            'P2-P2-P1: V1 template already exists for residential category';
    END IF;

    SELECT COUNT(*)
    INTO existing_active_count
    FROM public.beacon_manufacturing_templates
    WHERE category IN ('residential', 'residential_plus')
      AND active IS TRUE;

    IF existing_active_count <> 0 THEN
        RAISE EXCEPTION
            'P2-P2-P1: active template already exists for residential category';
    END IF;
END
$pre$;

DO $insert$
DECLARE
    inserted_count integer;
BEGIN
    INSERT INTO public.beacon_manufacturing_templates (
        category,
        version,
        name,
        width_mm,
        height_mm,
        material,
        finish,
        artwork_spec,
        active
    )
    VALUES
        (
            'residential',
            1,
            'Résidentiel Standard',
            250.00,
            150.00,
            'Aluminium composite (ACM/Dibond) 3 mm',
            'Impression UV extérieure + pelliculage mat anti-UV',
            jsonb_build_object(
                'model_code', 'AGN-RS-V1',
                'supplier_pdf', jsonb_build_object(
                    'background_hex', '#FFFFFF',
                    'border_hex', '#203F78',
                    'text_hex', '#111827',
                    'accent_hex', '#16A5AD',
                    'qr_position', 'right',
                    'number_position', 'bottom',
                    'label', 'ADRESSE GN'
                )
            ),
            TRUE
        ),
        (
            'residential_plus',
            1,
            'Résidentiel Premium',
            300.00,
            180.00,
            'Aluminium composite premium (ACM/Dibond) 3 mm',
            'Impression UV extérieure + pelliculage mat anti-UV renforcé',
            jsonb_build_object(
                'model_code', 'AGN-RP-V1',
                'supplier_pdf', jsonb_build_object(
                    'background_hex', '#FFFFFF',
                    'border_hex', '#203F78',
                    'text_hex', '#111827',
                    'accent_hex', '#16A5AD',
                    'qr_position', 'right',
                    'number_position', 'bottom',
                    'label', 'ADRESSE GN'
                )
            ),
            TRUE
        );

    GET DIAGNOSTICS inserted_count = ROW_COUNT;

    IF inserted_count <> 2 THEN
        RAISE EXCEPTION
            'P2-P2-P1: exact template insert count must be 2';
    END IF;
END
$insert$;

DO $post$
DECLARE
    standard_count integer;
    premium_count integer;
    target_v1_count integer;
    target_active_count integer;
BEGIN
    SELECT COUNT(*)
    INTO standard_count
    FROM public.beacon_manufacturing_templates
    WHERE category = 'residential'
      AND version = 1
      AND name = 'Résidentiel Standard'
      AND width_mm = 250.00
      AND height_mm = 150.00
      AND material = 'Aluminium composite (ACM/Dibond) 3 mm'
      AND finish = 'Impression UV extérieure + pelliculage mat anti-UV'
      AND active IS TRUE
      AND artwork_spec = jsonb_build_object(
          'model_code', 'AGN-RS-V1',
          'supplier_pdf', jsonb_build_object(
              'background_hex', '#FFFFFF',
              'border_hex', '#203F78',
              'text_hex', '#111827',
              'accent_hex', '#16A5AD',
              'qr_position', 'right',
              'number_position', 'bottom',
              'label', 'ADRESSE GN'
          )
      );

    SELECT COUNT(*)
    INTO premium_count
    FROM public.beacon_manufacturing_templates
    WHERE category = 'residential_plus'
      AND version = 1
      AND name = 'Résidentiel Premium'
      AND width_mm = 300.00
      AND height_mm = 180.00
      AND material = 'Aluminium composite premium (ACM/Dibond) 3 mm'
      AND finish = 'Impression UV extérieure + pelliculage mat anti-UV renforcé'
      AND active IS TRUE
      AND artwork_spec = jsonb_build_object(
          'model_code', 'AGN-RP-V1',
          'supplier_pdf', jsonb_build_object(
              'background_hex', '#FFFFFF',
              'border_hex', '#203F78',
              'text_hex', '#111827',
              'accent_hex', '#16A5AD',
              'qr_position', 'right',
              'number_position', 'bottom',
              'label', 'ADRESSE GN'
          )
      );

    SELECT COUNT(*)
    INTO target_v1_count
    FROM public.beacon_manufacturing_templates
    WHERE category IN ('residential', 'residential_plus')
      AND version = 1;

    SELECT COUNT(*)
    INTO target_active_count
    FROM public.beacon_manufacturing_templates
    WHERE category IN ('residential', 'residential_plus')
      AND active IS TRUE;

    IF standard_count <> 1 THEN
        RAISE EXCEPTION
            'P2-P2-P1: standard template postcondition failed';
    END IF;

    IF premium_count <> 1 THEN
        RAISE EXCEPTION
            'P2-P2-P1: premium template postcondition failed';
    END IF;

    IF target_v1_count <> 2 THEN
        RAISE EXCEPTION
            'P2-P2-P1: target V1 template count must be 2';
    END IF;

    IF target_active_count <> 2 THEN
        RAISE EXCEPTION
            'P2-P2-P1: target active template count must be 2';
    END IF;
END
$post$;

COMMIT;
