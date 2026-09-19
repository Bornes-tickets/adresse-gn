-- Phase 14C3 — canonical plan fulfillment normalization
-- Purpose:
--   * stop inferring fulfillment semantics from legacy plan codes;
--   * keep only the canonical consumer plans in direct checkout;
--   * keep the professional CMS plan as quote-only until its business flow is migrated;
--   * retain old plan rows for historical compatibility without deleting orders.

BEGIN;

ALTER TABLE public.cms_plans
  ADD COLUMN IF NOT EXISTS fulfillment_kind text;

ALTER TABLE public.cms_plans
  DROP CONSTRAINT IF EXISTS cms_plans_fulfillment_kind_check;

ALTER TABLE public.cms_plans
  ADD CONSTRAINT cms_plans_fulfillment_kind_check
  CHECK (
    fulfillment_kind = ANY (
      ARRAY[
        'digital_address'::text,
        'physical_installation'::text,
        'professional_quote'::text,
        'institutional_quote'::text,
        'business_subscription'::text,
        'api'::text,
        'legacy'::text
      ]
    )
  ) NOT VALID;

UPDATE public.cms_plans
SET
  fulfillment_kind = 'digital_address',
  audience = 'individual',
  requires_quote = false,
  plate_available = false,
  plate_included = false,
  installation_required = false,
  active = true
WHERE code = 'numerique';

UPDATE public.cms_plans
SET
  fulfillment_kind = 'physical_installation',
  audience = 'residential',
  requires_quote = false,
  plate_available = true,
  plate_included = true,
  installation_required = true,
  active = true
WHERE code = 'residentiel_standard';

UPDATE public.cms_plans
SET
  fulfillment_kind = 'professional_quote',
  audience = 'professional',
  requires_quote = true,
  plate_available = false,
  plate_included = false,
  installation_required = false,
  active = true
WHERE code = 'pro';

UPDATE public.cms_plans
SET
  fulfillment_kind = 'legacy',
  audience = 'legacy',
  active = false,
  popular = false
WHERE code = 'particulier';

UPDATE public.cms_plans
SET
  fulfillment_kind = 'legacy',
  audience = 'legacy',
  active = false,
  popular = false
WHERE code IN ('basic', 'plus');

DO $phase14c3_all_plans_classified$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.cms_plans
    WHERE fulfillment_kind IS NULL
  ) THEN
    RAISE EXCEPTION
      'Phase14C3: every cms_plans row must have fulfillment_kind';
  END IF;
END
$phase14c3_all_plans_classified$;

ALTER TABLE public.cms_plans
  ALTER COLUMN fulfillment_kind
  SET NOT NULL;

ALTER TABLE public.cms_plans
  VALIDATE CONSTRAINT cms_plans_fulfillment_kind_check;

COMMENT ON COLUMN public.cms_plans.fulfillment_kind IS
  'Canonical fulfillment contract used by checkout/payment: digital_address, physical_installation, professional_quote, institutional_quote, business_subscription, api, legacy.';

COMMIT;
