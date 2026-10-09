-- R18-CORE-OWNER-A3-R1
-- Machine-readable plan capabilities.
-- cms_plans.features remains commercial/display metadata.
-- Professional capabilities remain contractual and are not auto-granted.

ALTER TABLE public.cms_plans
ADD COLUMN IF NOT EXISTS capabilities jsonb
NOT NULL
DEFAULT '[]'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE
            conname = 'cms_plans_capabilities_is_array'
            AND conrelid = 'public.cms_plans'::regclass
    ) THEN
        ALTER TABLE public.cms_plans
        ADD CONSTRAINT cms_plans_capabilities_is_array
        CHECK (
            jsonb_typeof(capabilities) = 'array'
        );
    END IF;
END
$$;

UPDATE public.cms_plans
SET capabilities = '[
  "address_number",
  "qr_code",
  "gps_location",
  "external_navigation",
  "address_sharing"
]'::jsonb
WHERE code = 'numerique';

UPDATE public.cms_plans
SET capabilities = '[
  "address_number",
  "qr_code",
  "gps_location",
  "external_navigation",
  "address_sharing",
  "physical_plate",
  "installation_tracking"
]'::jsonb
WHERE code = 'residentiel_standard';

UPDATE public.cms_plans
SET capabilities = '[
  "address_number",
  "qr_code",
  "gps_location",
  "external_navigation",
  "address_sharing",
  "physical_plate",
  "installation_tracking",
  "enhanced_plate",
  "priority_installation_72h",
  "detailed_access_note",
  "replacement_assistance_12m"
]'::jsonb
WHERE code = 'residentiel_premium';

-- Quote-based professional rights are assigned only by an
-- accepted future contract/subscription workflow.
UPDATE public.cms_plans
SET capabilities = '[]'::jsonb
WHERE code = 'pro';

-- Legacy plans do not receive new rights automatically.
UPDATE public.cms_plans
SET capabilities = '[]'::jsonb
WHERE code IN (
    'particulier',
    'basic',
    'plus'
);

COMMENT ON COLUMN public.cms_plans.capabilities IS
'Machine-readable plan capability template. Commercial labels remain in features. Professional rights are contractual.';
