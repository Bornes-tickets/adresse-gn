\set ON_ERROR_STOP on

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================
-- ADRESSE GN — R13 LOCAL E2E BOOTSTRAP
--
-- Test-only schema.
-- NOT a production migration.
-- NOT a Supabase schema replacement.
--
-- Recreates only the PostgreSQL/PostGIS contract needed for:
--
--   payment confirmation
--   physical address preallocation
--   payment replay
--   installation planning
--   field-complete
-- =====================================================================

DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.installations CASCADE;
DROP TABLE IF EXISTS public.pending_installations CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.order_sites CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.addresses CASCADE;
DROP TABLE IF EXISTS public.beacons CASCADE;
DROP TABLE IF EXISTS public.agents CASCADE;
DROP TABLE IF EXISTS public.cms_plans CASCADE;
DROP TABLE IF EXISTS public.sectors CASCADE;
DROP TABLE IF EXISTS public.districts CASCADE;
DROP TABLE IF EXISTS public.communes CASCADE;
DROP TABLE IF EXISTS public.regions CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP SEQUENCE IF EXISTS
    public.address_national_id_seq
CASCADE;


-- ---------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------

CREATE TABLE public.profiles (
    id uuid PRIMARY KEY
        DEFAULT gen_random_uuid(),

    full_name text,
    phone text,

    role text NOT NULL
        DEFAULT 'user',

    created_at timestamptz NOT NULL
        DEFAULT now()
);


-- ---------------------------------------------------------------------
-- Geography
-- ---------------------------------------------------------------------

CREATE TABLE public.regions (
    id uuid PRIMARY KEY
        DEFAULT gen_random_uuid(),

    code text UNIQUE NOT NULL,
    name text NOT NULL,

    country_code text NOT NULL
        DEFAULT 'GN'
);


CREATE TABLE public.communes (
    id uuid PRIMARY KEY
        DEFAULT gen_random_uuid(),

    region_id uuid
        REFERENCES public.regions(id)
        ON DELETE CASCADE,

    name text NOT NULL,

    boundary geography(
        Polygon,
        4326
    ),

    -- Current Django service contract.
    -- Test-only shim because historical source DDL
    -- was not available in the extracted migrations.
    code varchar(5)
        UNIQUE
        NOT NULL,

    is_active boolean
        NOT NULL
        DEFAULT true,

    CONSTRAINT communes_e2e_code_check
        CHECK (
            code ~ '^[A-Z]{3}[0-9]{2}$'
        )
);


CREATE TABLE public.districts (
    id uuid PRIMARY KEY
        DEFAULT gen_random_uuid(),

    commune_id uuid
        REFERENCES public.communes(id)
        ON DELETE CASCADE,

    name text NOT NULL,

    boundary geography(
        Polygon,
        4326
    )
);


CREATE TABLE public.sectors (
    id uuid PRIMARY KEY
        DEFAULT gen_random_uuid(),

    district_id uuid
        REFERENCES public.districts(id)
        ON DELETE CASCADE,

    name text NOT NULL
);


-- ---------------------------------------------------------------------
-- CMS plans
-- ---------------------------------------------------------------------

CREATE TABLE public.cms_plans (
    id uuid PRIMARY KEY
        DEFAULT gen_random_uuid(),

    code text
        NOT NULL
        UNIQUE,

    name jsonb
        NOT NULL
        DEFAULT '{}'::jsonb,

    description jsonb
        NOT NULL
        DEFAULT '{}'::jsonb,

    features jsonb
        NOT NULL
        DEFAULT '{}'::jsonb,

    price_gnf bigint
        NOT NULL
        DEFAULT 0,

    period text
        NOT NULL
        DEFAULT 'once',

    popular boolean
        NOT NULL
        DEFAULT false,

    active boolean
        NOT NULL
        DEFAULT true,

    position integer
        NOT NULL
        DEFAULT 0,

    audience text,

    price_from_gnf bigint,
    price_to_gnf bigint,

    recurring_price_gnf bigint
        NOT NULL
        DEFAULT 0,

    billing_period text
        NOT NULL
        DEFAULT 'none',

    requires_quote boolean
        NOT NULL
        DEFAULT false,

    plate_available boolean
        NOT NULL
        DEFAULT false,

    plate_included boolean
        NOT NULL
        DEFAULT false,

    installation_required boolean
        NOT NULL
        DEFAULT false,

    max_addresses integer,

    fulfillment_kind text
        NOT NULL,

    created_at timestamptz
        NOT NULL
        DEFAULT now(),

    updated_at timestamptz
        NOT NULL
        DEFAULT now(),

    CONSTRAINT cms_plans_e2e_fulfillment_check
        CHECK (
            fulfillment_kind IN (
                'digital_address',
                'physical_installation',
                'professional_quote',
                'institutional_quote',
                'business_subscription',
                'api',
                'legacy'
            )
        )
);


-- ---------------------------------------------------------------------
-- Beacon
-- ---------------------------------------------------------------------

CREATE TABLE public.beacons (
    id uuid PRIMARY KEY
        DEFAULT gen_random_uuid(),

    public_number text
        UNIQUE
        NOT NULL,

    qr_token uuid
        UNIQUE
        NOT NULL
        DEFAULT gen_random_uuid(),

    status text
        NOT NULL
        DEFAULT 'generated',

    category text,

    lot_id uuid,

    created_at timestamptz
        NOT NULL
        DEFAULT now(),

    activated_at timestamptz,

    national_id varchar(8),

    check_digit varchar(1),

    commune_code_at_issue varchar(5),

    numbering_version varchar(16)
        NOT NULL
        DEFAULT 'legacy',

    CONSTRAINT beacons_e2e_status_check
        CHECK (
            status IN (
                'generated',
                'assigned',
                'installed',
                'active',
                'suspended',
                'replaced',
                'cancelled'
            )
        ),

    CONSTRAINT beacons_e2e_numbering_version_check
        CHECK (
            numbering_version IN (
                'legacy',
                'v1'
            )
        ),

    CONSTRAINT beacons_e2e_numbering_fields_check
        CHECK (
            (
                numbering_version = 'legacy'
                AND national_id IS NULL
                AND check_digit IS NULL
                AND commune_code_at_issue IS NULL
                AND public_number
                    ~ '^GN-[A-Z]{3}-[0-9]{6}$'
            )
            OR
            (
                numbering_version = 'v1'
                AND national_id
                    ~ '^[0-9]{8}$'
                AND check_digit
                    ~ '^[0-9]$'
                AND commune_code_at_issue
                    ~ '^[A-Z]{3}[0-9]{2}$'
                AND public_number
                    ~ '^[A-Z]{3}[0-9]{2}-[0-9]{9}$'
                AND public_number =
                    commune_code_at_issue
                    || '-'
                    || national_id
                    || check_digit
            )
        )
);


CREATE UNIQUE INDEX
    beacons_national_id_unique
ON public.beacons(national_id)
WHERE national_id IS NOT NULL;


-- ---------------------------------------------------------------------
-- Address
-- ---------------------------------------------------------------------

CREATE TABLE public.addresses (
    id uuid PRIMARY KEY
        DEFAULT gen_random_uuid(),

    beacon_id uuid
        UNIQUE
        NOT NULL
        REFERENCES public.beacons(id)
        ON DELETE CASCADE,

    owner_id uuid
        REFERENCES public.profiles(id),

    category text
        NOT NULL
        DEFAULT 'other',

    name text,

    location geography(
        Point,
        4326
    ),

    accuracy_m numeric(6,2),

    visibility text
        NOT NULL
        DEFAULT 'private',

    verification_level text
        NOT NULL
        DEFAULT 'unverified',

    access_point_note text,

    status text
        NOT NULL
        DEFAULT 'active',

    commune_id uuid
        REFERENCES public.communes(id),

    district_id uuid
        REFERENCES public.districts(id),

    sector_id uuid
        REFERENCES public.sectors(id),

    created_at timestamptz
        NOT NULL
        DEFAULT now(),

    updated_at timestamptz
        NOT NULL
        DEFAULT now(),

    CONSTRAINT addresses_e2e_visibility_check
        CHECK (
            visibility IN (
                'private',
                'public'
            )
        ),

    CONSTRAINT addresses_e2e_verification_check
        CHECK (
            verification_level IN (
                'unverified',
                'pending',
                'verified'
            )
        ),

    CONSTRAINT addresses_e2e_status_check
        CHECK (
            status IN (
                'active',
                'suspended',
                'deleted'
            )
        )
);


CREATE INDEX
    idx_addresses_location
ON public.addresses
USING gist(location);


-- ---------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------

CREATE TABLE public.orders (
    id uuid PRIMARY KEY
        DEFAULT gen_random_uuid(),

    customer_id uuid
        REFERENCES public.profiles(id),

    offer_code text NOT NULL,

    amount_gnf bigint NOT NULL,

    status text
        NOT NULL
        DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'paid',
                'cancelled',
                'refunded'
            )
        ),

    order_ref text
        NOT NULL
        UNIQUE,

    items jsonb
        NOT NULL
        DEFAULT '[]'::jsonb,

    beacon_id uuid
        REFERENCES public.beacons(id)
        ON DELETE SET NULL,

    notes text,

    phone text,

    devis_demande boolean
        NOT NULL
        DEFAULT false,

    plan_id uuid
        REFERENCES public.cms_plans(id)
        ON DELETE SET NULL,

    installed_at timestamptz,

    created_at timestamptz
        NOT NULL
        DEFAULT now(),

    updated_at timestamptz
        NOT NULL
        DEFAULT now()
);


CREATE TABLE public.order_sites (
    id uuid PRIMARY KEY
        DEFAULT gen_random_uuid(),

    order_id uuid
        NOT NULL
        REFERENCES public.orders(id)
        ON DELETE CASCADE,

    sequence_no integer
        NOT NULL
        DEFAULT 1,

    place_type text
        NOT NULL
        DEFAULT 'other',

    place_name text,

    requested_location geography(
        Point,
        4326
    ),

    location_accuracy_m numeric,

    commune_id uuid
        REFERENCES public.communes(id)
        ON DELETE SET NULL,

    district_id uuid
        REFERENCES public.districts(id)
        ON DELETE SET NULL,

    sector_id uuid
        REFERENCES public.sectors(id)
        ON DELETE SET NULL,

    address_line text,

    access_point_note text,

    beacon_id uuid
        REFERENCES public.beacons(id)
        ON DELETE SET NULL,

    status text
        NOT NULL
        DEFAULT 'pending',

    created_at timestamptz
        NOT NULL
        DEFAULT now(),

    updated_at timestamptz
        NOT NULL
        DEFAULT now(),

    CONSTRAINT order_sites_sequence_positive
        CHECK (
            sequence_no > 0
        ),

    CONSTRAINT order_sites_order_sequence_key
        UNIQUE (
            order_id,
            sequence_no
        )
);


-- ---------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------

CREATE TABLE public.payments (
    id uuid PRIMARY KEY
        DEFAULT gen_random_uuid(),

    order_id uuid
        NOT NULL
        REFERENCES public.orders(id)
        ON DELETE CASCADE,

    provider text
        NOT NULL,

    external_ref text,

    amount_gnf bigint
        NOT NULL,

    status text
        NOT NULL
        DEFAULT 'pending',

    intent_id text,

    webhook_payload jsonb,

    confirmed_by uuid
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    confirmed_at timestamptz,

    paid_at timestamptz,

    created_at timestamptz
        NOT NULL
        DEFAULT now(),

    CONSTRAINT payments_e2e_provider_check
        CHECK (
            provider IN (
                'manual',
                'orange',
                'mtn',
                'card',
                'cash',
                'transfer'
            )
        ),

    CONSTRAINT payments_e2e_status_check
        CHECK (
            status IN (
                'pending',
                'success',
                'failed',
                'refunded'
            )
        ),

    CONSTRAINT payments_e2e_amount_nonnegative
        CHECK (
            amount_gnf >= 0
        )
);


-- ---------------------------------------------------------------------
-- Agents
-- ---------------------------------------------------------------------

CREATE TABLE public.agents (
    id uuid PRIMARY KEY
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    badge_number text
        UNIQUE
        NOT NULL,

    zone_id uuid
        REFERENCES public.communes(id),

    active boolean
        NOT NULL
        DEFAULT true,

    hired_at date
);


-- ---------------------------------------------------------------------
-- Pending installation
-- ---------------------------------------------------------------------

CREATE TABLE public.pending_installations (
    id uuid PRIMARY KEY
        DEFAULT gen_random_uuid(),

    beacon_id uuid
        REFERENCES public.beacons(id)
        ON DELETE CASCADE,

    order_id uuid
        REFERENCES public.orders(id)
        ON DELETE SET NULL,

    customer_id uuid
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,

    phone text,
    note text,

    status text
        NOT NULL
        DEFAULT 'pending',

    assigned_agent_id uuid
        REFERENCES public.agents(id)
        ON DELETE SET NULL,

    scheduled_at timestamptz,
    completed_at timestamptz,

    created_at timestamptz
        NOT NULL
        DEFAULT now(),

    updated_at timestamptz
        NOT NULL
        DEFAULT now(),

    CONSTRAINT pending_installations_e2e_status_check
        CHECK (
            status IN (
                'pending',
                'assigned',
                'planned',
                'installed',
                'done',
                'cancelled'
            )
        ),

    CONSTRAINT pending_installations_e2e_completed_state_check
        CHECK (
            (
                status = 'done'
                AND completed_at IS NOT NULL
            )
            OR
            (
                status <> 'done'
                AND completed_at IS NULL
            )
        )
);


CREATE UNIQUE INDEX
    pending_installations_one_per_order_uidx
ON public.pending_installations(order_id)
WHERE order_id IS NOT NULL;


-- ---------------------------------------------------------------------
-- Installation
-- ---------------------------------------------------------------------

CREATE TABLE public.installations (
    id uuid PRIMARY KEY
        DEFAULT gen_random_uuid(),

    beacon_id uuid
        REFERENCES public.beacons(id)
        ON DELETE CASCADE,

    agent_id uuid
        REFERENCES public.agents(id),

    gps_lat numeric(10,7)
        NOT NULL,

    gps_lng numeric(10,7)
        NOT NULL,

    accuracy_m numeric(6,2),

    photo_url text,

    installed_at timestamptz
        NOT NULL
        DEFAULT now(),

    validated_at timestamptz,

    validator_id uuid
        REFERENCES public.profiles(id),

    order_site_id uuid
        REFERENCES public.order_sites(id)
);


-- ---------------------------------------------------------------------
-- Notifications / audit
-- ---------------------------------------------------------------------

CREATE TABLE public.notifications (
    id uuid PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id uuid
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    type text NOT NULL,

    payload jsonb,

    read boolean
        NOT NULL
        DEFAULT false,

    created_at timestamptz
        NOT NULL
        DEFAULT now()
);


CREATE TABLE public.audit_logs (
    id uuid PRIMARY KEY
        DEFAULT gen_random_uuid(),

    actor_id uuid
        REFERENCES public.profiles(id),

    action text NOT NULL,

    entity text NOT NULL,

    entity_id uuid,

    before jsonb,

    after jsonb,

    created_at timestamptz
        NOT NULL
        DEFAULT now()
);


-- ---------------------------------------------------------------------
-- National sequence
-- ---------------------------------------------------------------------

CREATE SEQUENCE
    public.address_national_id_seq
AS bigint
START WITH 58274136
INCREMENT BY 1
MINVALUE 10000000
MAXVALUE 99999999
NO CYCLE;


-- ---------------------------------------------------------------------
-- Canonical physical plan
-- ---------------------------------------------------------------------

INSERT INTO public.cms_plans (
    code,
    name,
    price_gnf,
    requires_quote,
    plate_available,
    plate_included,
    installation_required,
    fulfillment_kind
)
VALUES (
    'residentiel_standard',
    '{"fr":"Résidentiel Standard"}'::jsonb,
    150000,
    false,
    true,
    true,
    true,
    'physical_installation'
);


-- ---------------------------------------------------------------------
-- Bootstrap invariant
-- ---------------------------------------------------------------------

DO $$
DECLARE
    v_last bigint;
    v_called boolean;
BEGIN

    SELECT
        last_value,
        is_called
    INTO
        v_last,
        v_called
    FROM public.address_national_id_seq;

    IF
        v_last IS DISTINCT FROM 58274136
        OR
        v_called IS DISTINCT FROM false
    THEN
        RAISE EXCEPTION
            'Invalid R13 E2E sequence state: %, %',
            v_last,
            v_called;
    END IF;

END
$$;

COMMIT;
