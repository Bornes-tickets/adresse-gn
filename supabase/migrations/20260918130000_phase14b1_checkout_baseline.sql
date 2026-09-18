-- =====================================================================
-- Phase 14B1 — Checkout schema baseline
-- Generated from the audited production schema on 2026-09-18.
--
-- Goal:
--   * make checkout schema reproducible from Git;
--   * preserve current production semantics;
--   * do NOT yet fix legacy role/payment vocabulary.
--
-- Follow-up Phase 14B2 will normalize:
--   commercial -> sales
--   institution -> institutionnel at the application boundary
--   orange_money -> orange at the payment-provider boundary
--   overly broad direct grants where appropriate.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Current application role vocabulary
-- ---------------------------------------------------------------------

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (
    role = ANY (
        ARRAY[
            'user'::text,
            'agent'::text,
            'supervisor'::text,
            'admin'::text,
            'super_admin'::text,
            'sales'::text,
            'ops'::text,
            'support'::text
        ]
    )
);

-- ---------------------------------------------------------------------
-- 2. CMS plan extensions used by checkout
-- ---------------------------------------------------------------------

ALTER TABLE public.cms_plans
    ADD COLUMN IF NOT EXISTS audience text,
    ADD COLUMN IF NOT EXISTS price_from_gnf bigint,
    ADD COLUMN IF NOT EXISTS price_to_gnf bigint,
    ADD COLUMN IF NOT EXISTS recurring_price_gnf bigint NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS billing_period text NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS requires_quote boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS plate_available boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS plate_included boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS installation_required boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS max_addresses integer;

-- ---------------------------------------------------------------------
-- 3. Orders extensions used by the current checkout
-- ---------------------------------------------------------------------

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS guest_token text,
    ADD COLUMN IF NOT EXISTS user_id uuid,
    ADD COLUMN IF NOT EXISTS client_type text,
    ADD COLUMN IF NOT EXISTS full_name text,
    ADD COLUMN IF NOT EXISTS phone text,
    ADD COLUMN IF NOT EXISTS email text,
    ADD COLUMN IF NOT EXISTS address_line text,
    ADD COLUMN IF NOT EXISTS quartier text,
    ADD COLUMN IF NOT EXISTS city text DEFAULT 'Conakry',
    ADD COLUMN IF NOT EXISTS raison_sociale text,
    ADD COLUMN IF NOT EXISTS fonction text,
    ADD COLUMN IF NOT EXISTS rccm text,
    ADD COLUMN IF NOT EXISTS nif text,
    ADD COLUMN IF NOT EXISTS site_web text,
    ADD COLUMN IF NOT EXISTS nb_adresses integer DEFAULT 1,
    ADD COLUMN IF NOT EXISTS devis_demande boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS formule_code text,
    ADD COLUMN IF NOT EXISTS formule_label text,
    ADD COLUMN IF NOT EXISTS prix_ttc bigint,
    ADD COLUMN IF NOT EXISTS payment_method text,
    ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
    ADD COLUMN IF NOT EXISTS installed_at timestamptz,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS plan_id uuid,
    ADD COLUMN IF NOT EXISTS recurring_amount_gnf bigint NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz,
    ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
    ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
    ADD COLUMN IF NOT EXISTS submission_channel text NOT NULL DEFAULT 'web',
    ADD COLUMN IF NOT EXISTS verification_channel text,
    ADD COLUMN IF NOT EXISTS identity_verified_at timestamptz;

UPDATE public.orders
SET guest_token = encode(gen_random_bytes(12), 'base64')
WHERE guest_token IS NULL;

ALTER TABLE public.orders
    ALTER COLUMN guest_token
    SET DEFAULT encode(gen_random_bytes(12), 'base64');

ALTER TABLE public.orders
    ALTER COLUMN guest_token SET NOT NULL;

DO $phase14b1_constraints$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE
            conrelid = 'public.orders'::regclass
            AND conname = 'orders_guest_token_key'
    ) THEN
        ALTER TABLE public.orders
        ADD CONSTRAINT orders_guest_token_key
        UNIQUE (guest_token);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE
            conrelid = 'public.orders'::regclass
            AND conname = 'orders_user_id_fkey'
    ) THEN
        ALTER TABLE public.orders
        ADD CONSTRAINT orders_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE
            conrelid = 'public.orders'::regclass
            AND conname = 'orders_plan_id_fkey'
    ) THEN
        ALTER TABLE public.orders
        ADD CONSTRAINT orders_plan_id_fkey
        FOREIGN KEY (plan_id)
        REFERENCES public.cms_plans(id)
        ON DELETE SET NULL;
    END IF;
END
$phase14b1_constraints$;

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_client_type_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_client_type_check
CHECK (
    client_type = ANY (
        ARRAY[
            'particulier'::text,
            'professionnel'::text,
            'institutionnel'::text
        ]
    )
);

-- ---------------------------------------------------------------------
-- 4. Site(s) attached to an order
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.order_sites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL
        REFERENCES public.orders(id)
        ON DELETE CASCADE,
    sequence_no integer NOT NULL DEFAULT 1,
    place_type text NOT NULL DEFAULT 'other',
    place_name text,
    requested_location geography(Point, 4326),
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
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT order_sites_sequence_positive
        CHECK (sequence_no > 0),
    CONSTRAINT order_sites_order_sequence_key
        UNIQUE (order_id, sequence_no)
);

-- ---------------------------------------------------------------------
-- 5. Order status history
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.order_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL
        REFERENCES public.orders(id)
        ON DELETE CASCADE,
    event_type text NOT NULL,
    old_status text,
    new_status text,
    actor_id uuid
        REFERENCES public.profiles(id)
        ON DELETE SET NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 6. Missing indexes
-- ---------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_orders_beacon_id
    ON public.orders(beacon_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_created
    ON public.orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_plan_id
    ON public.orders(plan_id);
CREATE INDEX IF NOT EXISTS idx_orders_submitted_at
    ON public.orders(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_verification_channel
    ON public.orders(verification_channel);
CREATE INDEX IF NOT EXISTS orders_guest_token_idx
    ON public.orders(guest_token);
CREATE INDEX IF NOT EXISTS orders_phone_idx
    ON public.orders(phone);
CREATE INDEX IF NOT EXISTS orders_user_id_idx
    ON public.orders(user_id);

CREATE INDEX IF NOT EXISTS idx_order_sites_beacon
    ON public.order_sites(beacon_id);
CREATE INDEX IF NOT EXISTS idx_order_sites_commune
    ON public.order_sites(commune_id);
CREATE INDEX IF NOT EXISTS idx_order_sites_district
    ON public.order_sites(district_id);
CREATE INDEX IF NOT EXISTS idx_order_sites_location
    ON public.order_sites
    USING gist(requested_location);
CREATE INDEX IF NOT EXISTS idx_order_sites_order
    ON public.order_sites(order_id);
CREATE INDEX IF NOT EXISTS idx_order_sites_sector
    ON public.order_sites(sector_id);
CREATE INDEX IF NOT EXISTS idx_order_sites_status
    ON public.order_sites(status);

CREATE INDEX IF NOT EXISTS idx_order_events_order_created
    ON public.order_events(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_order_id
    ON public.payments(order_id);

-- ---------------------------------------------------------------------
-- 7. Exact currently deployed functions
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.log_order_status_event_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
begin
  if tg_op = 'INSERT' then
    insert into public.order_events (
      order_id,
      event_type,
      old_status,
      new_status,
      actor_id,
      metadata
    )
    values (
      new.id,
      'created',
      null,
      new.status,
      auth.uid(),
      jsonb_build_object('source', 'orders_trigger')
    );

  elsif tg_op = 'UPDATE'
    and new.status is distinct from old.status then

    insert into public.order_events (
      order_id,
      event_type,
      old_status,
      new_status,
      actor_id,
      metadata
    )
    values (
      new.id,
      'status_changed',
      old.status,
      new.status,
      auth.uid(),
      jsonb_build_object('source', 'orders_trigger')
    );
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_address_order_v1(p_plan_code text, p_client_type text, p_full_name text, p_email text DEFAULT NULL::text, p_payment_method text DEFAULT NULL::text, p_place_type text DEFAULT 'other'::text, p_place_name text DEFAULT NULL::text, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_accuracy_m numeric DEFAULT NULL::numeric, p_commune_id uuid DEFAULT NULL::uuid, p_district_id uuid DEFAULT NULL::uuid, p_sector_id uuid DEFAULT NULL::uuid, p_address_line text DEFAULT NULL::text, p_access_point_note text DEFAULT NULL::text, p_devis_demande boolean DEFAULT false, p_submission_channel text DEFAULT 'web'::text)
 RETURNS TABLE(order_id uuid, order_ref text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
declare
  v_uid uuid;

  v_auth_phone text;
  v_auth_email text;
  v_phone_confirmed_at timestamptz;
  v_email_confirmed_at timestamptz;
  v_user_metadata jsonb;

  v_verification_channel text;
  v_contact_phone text;
  v_contact_email text;
  v_identity_verified_at timestamptz;

  v_plan public.cms_plans%rowtype;
  v_order public.orders%rowtype;
  v_label text;
  v_channel text;
  v_location geography(Point, 4326);
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select
    u.phone,
    u.email,
    u.phone_confirmed_at,
    u.email_confirmed_at,
    coalesce(u.raw_user_meta_data, '{}'::jsonb)
  into
    v_auth_phone,
    v_auth_email,
    v_phone_confirmed_at,
    v_email_confirmed_at,
    v_user_metadata
  from auth.users u
  where u.id = v_uid;

  if not found then
    raise exception 'AUTH_USER_NOT_FOUND';
  end if;

  v_verification_channel := lower(
    coalesce(
      nullif(v_user_metadata ->> 'adresse_gn_verification_channel', ''),
      case
        when v_phone_confirmed_at is not null then 'sms'
        when v_email_confirmed_at is not null then 'email'
        else null
      end
    )
  );

  if v_verification_channel not in ('whatsapp', 'email', 'sms') then
    raise exception 'INVALID_VERIFICATION_CHANNEL';
  end if;

  if v_verification_channel in ('whatsapp', 'sms') then
    if v_phone_confirmed_at is null then
      raise exception 'PHONE_NOT_VERIFIED';
    end if;

    v_contact_phone := v_auth_phone;
    v_contact_email := nullif(btrim(coalesce(p_email, '')), '');
    v_identity_verified_at := v_phone_confirmed_at;

  elsif v_verification_channel = 'email' then
    if v_email_confirmed_at is null then
      raise exception 'EMAIL_NOT_VERIFIED';
    end if;

    if p_email is not null
       and btrim(p_email) <> ''
       and lower(btrim(p_email)) <> lower(v_auth_email) then
      raise exception 'EMAIL_MISMATCH';
    end if;

    v_contact_email := v_auth_email;
    v_contact_phone := nullif(
      btrim(coalesce(v_user_metadata ->> 'adresse_gn_contact_phone', '')),
      ''
    );

    if v_contact_phone is not null
       and v_contact_phone !~ '^\+224[0-9]{9}$' then
      raise exception 'INVALID_CONTACT_PHONE';
    end if;

    v_identity_verified_at := v_email_confirmed_at;
  end if;

  select *
  into v_plan
  from public.cms_plans
  where code = p_plan_code
    and active = true
  limit 1;

  if not found then
    raise exception 'PLAN_NOT_FOUND_OR_INACTIVE';
  end if;

  if p_full_name is null or btrim(p_full_name) = '' then
    raise exception 'FULL_NAME_REQUIRED';
  end if;

  if (p_lat is null and p_lng is not null)
     or (p_lat is not null and p_lng is null) then
    raise exception 'LAT_LNG_MUST_BE_PROVIDED_TOGETHER';
  end if;

  if p_lat is not null and (p_lat < -90 or p_lat > 90) then
    raise exception 'INVALID_LATITUDE';
  end if;

  if p_lng is not null and (p_lng < -180 or p_lng > 180) then
    raise exception 'INVALID_LONGITUDE';
  end if;

  if p_lat is not null and p_lng is not null then
    v_location :=
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  else
    v_location := null;
  end if;

  v_label := coalesce(
    nullif(v_plan.name ->> 'fr', ''),
    nullif(v_plan.name ->> 'en', ''),
    v_plan.code
  );

  v_channel := case
    when p_submission_channel in ('web', 'android', 'ios', 'agent', 'admin', 'api')
      then p_submission_channel
    else 'web'
  end;

  insert into public.profiles (
    id,
    full_name,
    phone
  )
  values (
    v_uid,
    p_full_name,
    v_contact_phone
  )
  on conflict (id) do update
  set
    full_name = case
      when excluded.full_name is not null
       and btrim(excluded.full_name) <> ''
      then excluded.full_name
      else public.profiles.full_name
    end,
    phone = coalesce(excluded.phone, public.profiles.phone);

  insert into public.orders (
    customer_id,
    plan_id,

    offer_code,
    amount_gnf,
    recurring_amount_gnf,

    status,
    items,

    client_type,
    full_name,
    phone,
    email,

    address_line,

    nb_adresses,
    devis_demande,

    formule_code,
    formule_label,
    prix_ttc,

    payment_method,

    phone_verified_at,
    verification_channel,
    identity_verified_at,
    submitted_at,
    submission_channel
  )
  values (
    v_uid,
    v_plan.id,

    v_plan.code,
    v_plan.price_gnf,
    coalesce(v_plan.recurring_price_gnf, 0),

    'pending',
    jsonb_build_array(
      jsonb_build_object(
        'qty', 1,
        'code', v_plan.code,
        'label', v_label
      )
    ),

    p_client_type,
    p_full_name,
    v_contact_phone,
    v_contact_email,

    p_address_line,

    1,
    coalesce(p_devis_demande, false),

    v_plan.code,
    v_label,
    v_plan.price_gnf,

    p_payment_method,

    case
      when v_verification_channel in ('whatsapp', 'sms')
        then v_phone_confirmed_at
      else null
    end,
    v_verification_channel,
    v_identity_verified_at,
    now(),
    v_channel
  )
  returning *
  into v_order;

  insert into public.order_sites (
    order_id,
    sequence_no,
    place_type,
    place_name,
    requested_location,
    location_accuracy_m,
    commune_id,
    district_id,
    sector_id,
    address_line,
    access_point_note,
    status
  )
  values (
    v_order.id,
    1,
    coalesce(nullif(btrim(p_place_type), ''), 'other'),
    nullif(btrim(coalesce(p_place_name, '')), ''),
    v_location,
    p_accuracy_m,
    p_commune_id,
    p_district_id,
    p_sector_id,
    p_address_line,
    p_access_point_note,
    'pending'
  );

  return query
  select v_order.id, v_order.order_ref;
end;
$function$;

-- ACL of next_order_ref currently deployed
REVOKE ALL
ON FUNCTION public.next_order_ref()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.next_order_ref()
TO service_role;

-- Checkout RPC ACL currently deployed
REVOKE ALL
ON FUNCTION public.submit_address_order_v1(
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    double precision,
    double precision,
    numeric,
    uuid,
    uuid,
    uuid,
    text,
    text,
    boolean,
    text
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.submit_address_order_v1(
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    double precision,
    double precision,
    numeric,
    uuid,
    uuid,
    uuid,
    text,
    text,
    boolean,
    text
)
TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 8. Triggers absent from Git history
-- ---------------------------------------------------------------------

DROP TRIGGER IF EXISTS orders_set_updated_at
ON public.orders;

CREATE TRIGGER orders_set_updated_at
BEFORE UPDATE
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_status_event_v1
ON public.orders;

CREATE TRIGGER trg_orders_status_event_v1
AFTER INSERT OR UPDATE OF status
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION private.log_order_status_event_v1();

-- ---------------------------------------------------------------------
-- 9. RLS state and exact current checkout policies
-- ---------------------------------------------------------------------

ALTER TABLE public.orders
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.order_sites
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.order_events
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payments
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer read own order events" ON public."order_events";
CREATE POLICY "customer read own order events" ON public."order_events" AS PERMISSIVE FOR SELECT TO "authenticated"
USING (
(( SELECT private.current_account_is_active() AS current_account_is_active) AND ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_events.order_id) AND (o.customer_id = auth.uid())))) OR private.current_role_is(ARRAY['commercial'::text, 'supervisor'::text, 'qc'::text, 'admin'::text, 'super_admin'::text])))
);

DROP POLICY IF EXISTS "customer read own order sites" ON public."order_sites";
CREATE POLICY "customer read own order sites" ON public."order_sites" AS PERMISSIVE FOR SELECT TO "authenticated"
USING (
(( SELECT private.current_account_is_active() AS current_account_is_active) AND ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_sites.order_id) AND (o.customer_id = auth.uid())))) OR private.current_role_is(ARRAY['commercial'::text, 'supervisor'::text, 'qc'::text, 'admin'::text, 'super_admin'::text]) OR (private.current_role_is(ARRAY['agent'::text]) AND (EXISTS ( SELECT 1
   FROM beacons b
  WHERE ((b.id = order_sites.beacon_id) AND (b.assigned_agent_id = auth.uid())))))))
);

DROP POLICY IF EXISTS "customer read orders" ON public."orders";
CREATE POLICY "customer read orders" ON public."orders" AS PERMISSIVE FOR SELECT TO "authenticated"
USING (
(( SELECT private.current_account_is_active() AS current_account_is_active) AND ((customer_id = auth.uid()) OR private.current_role_is(ARRAY['admin'::text, 'commercial'::text, 'super_admin'::text])))
);

DROP POLICY IF EXISTS "orders_own_insert" ON public."orders";
CREATE POLICY "orders_own_insert" ON public."orders" AS PERMISSIVE FOR INSERT TO "authenticated"
WITH CHECK (
(( SELECT private.current_account_is_active() AS current_account_is_active) AND (customer_id = auth.uid()))
);

DROP POLICY IF EXISTS "customer read payments" ON public."payments";
CREATE POLICY "customer read payments" ON public."payments" AS PERMISSIVE FOR SELECT TO "authenticated"
USING (
(( SELECT private.current_account_is_active() AS current_account_is_active) AND (EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = payments.order_id) AND ((o.customer_id = auth.uid()) OR private.current_role_is(ARRAY['admin'::text, 'commercial'::text, 'super_admin'::text]))))))
);

-- ---------------------------------------------------------------------
-- 10. Exact effective direct grants currently deployed
-- ---------------------------------------------------------------------

REVOKE ALL PRIVILEGES ON TABLE public."orders" FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public."orders" TO "service_role";

REVOKE ALL PRIVILEGES ON TABLE public."order_sites" FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public."order_sites" TO "anon";
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public."order_sites" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public."order_sites" TO "service_role";

REVOKE ALL PRIVILEGES ON TABLE public."order_events" FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public."order_events" TO "anon";
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public."order_events" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public."order_events" TO "service_role";

REVOKE ALL PRIVILEGES ON TABLE public."payments" FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public."payments" TO "anon";
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public."payments" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public."payments" TO "service_role";

-- ---------------------------------------------------------------------
-- 11. Current plan catalogue
-- ---------------------------------------------------------------------

INSERT INTO public.cms_plans (
    code, name, description, features, price_gnf, period, popular, active, position,
    audience, price_from_gnf, price_to_gnf, recurring_price_gnf, billing_period,
    requires_quote, plate_available, plate_included, installation_required, max_addresses
)
VALUES (
    'particulier',
    '{"ar": "فرد", "en": "Individual", "fr": "Particulier"}'::jsonb,
    '{"ar": "علامة واحدة لمنزلك.", "en": "One beacon for your home.", "fr": "Une balise pour votre domicile."}'::jsonb,
    '{"ar": ["علامة + رمز QR", "تثبيت بنظام GPS", "صفحة عنوان قابلة للمشاركة"], "en": ["Beacon + QR code", "GPS installation", "Shareable address page"], "fr": ["Balise + QR code", "Installation GPS", "Fiche adresse partageable"]}'::jsonb,
    150000,
    'once',
    TRUE,
    TRUE,
    1,
    NULL,
    150000,
    150000,
    0,
    'none',
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    NULL
)
ON CONFLICT (code) DO UPDATE
SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    features = EXCLUDED.features,
    price_gnf = EXCLUDED.price_gnf,
    period = EXCLUDED.period,
    popular = EXCLUDED.popular,
    active = EXCLUDED.active,
    position = EXCLUDED.position,
    audience = EXCLUDED.audience,
    price_from_gnf = EXCLUDED.price_from_gnf,
    price_to_gnf = EXCLUDED.price_to_gnf,
    recurring_price_gnf = EXCLUDED.recurring_price_gnf,
    billing_period = EXCLUDED.billing_period,
    requires_quote = EXCLUDED.requires_quote,
    plate_available = EXCLUDED.plate_available,
    plate_included = EXCLUDED.plate_included,
    installation_required = EXCLUDED.installation_required,
    max_addresses = EXCLUDED.max_addresses
WHERE ROW(
    public.cms_plans.name, public.cms_plans.description, public.cms_plans.features,
    public.cms_plans.price_gnf, public.cms_plans.period, public.cms_plans.popular,
    public.cms_plans.active, public.cms_plans.position, public.cms_plans.audience,
    public.cms_plans.price_from_gnf, public.cms_plans.price_to_gnf,
    public.cms_plans.recurring_price_gnf, public.cms_plans.billing_period,
    public.cms_plans.requires_quote, public.cms_plans.plate_available,
    public.cms_plans.plate_included, public.cms_plans.installation_required,
    public.cms_plans.max_addresses
) IS DISTINCT FROM ROW(
    EXCLUDED.name, EXCLUDED.description, EXCLUDED.features, EXCLUDED.price_gnf,
    EXCLUDED.period, EXCLUDED.popular, EXCLUDED.active, EXCLUDED.position,
    EXCLUDED.audience, EXCLUDED.price_from_gnf, EXCLUDED.price_to_gnf,
    EXCLUDED.recurring_price_gnf, EXCLUDED.billing_period, EXCLUDED.requires_quote,
    EXCLUDED.plate_available, EXCLUDED.plate_included, EXCLUDED.installation_required,
    EXCLUDED.max_addresses
);

INSERT INTO public.cms_plans (
    code, name, description, features, price_gnf, period, popular, active, position,
    audience, price_from_gnf, price_to_gnf, recurring_price_gnf, billing_period,
    requires_quote, plate_available, plate_included, installation_required, max_addresses
)
VALUES (
    'pro',
    '{"ar": "احترافي", "en": "Business", "fr": "Professionnel"}'::jsonb,
    '{"ar": "للمتاجر والشركات.", "en": "For shops and companies.", "fr": "Pour commerces et entreprises."}'::jsonb,
    '{"ar": ["صفحة المنشأة", "صور ومواعيد العمل", "إحصاءات الزيارات"], "en": ["Business page", "Photos and opening hours", "Visit statistics"], "fr": ["Fiche établissement", "Photos et horaires", "Statistiques de visite"]}'::jsonb,
    450000,
    'year',
    FALSE,
    TRUE,
    2,
    NULL,
    450000,
    450000,
    0,
    'none',
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    NULL
)
ON CONFLICT (code) DO UPDATE
SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    features = EXCLUDED.features,
    price_gnf = EXCLUDED.price_gnf,
    period = EXCLUDED.period,
    popular = EXCLUDED.popular,
    active = EXCLUDED.active,
    position = EXCLUDED.position,
    audience = EXCLUDED.audience,
    price_from_gnf = EXCLUDED.price_from_gnf,
    price_to_gnf = EXCLUDED.price_to_gnf,
    recurring_price_gnf = EXCLUDED.recurring_price_gnf,
    billing_period = EXCLUDED.billing_period,
    requires_quote = EXCLUDED.requires_quote,
    plate_available = EXCLUDED.plate_available,
    plate_included = EXCLUDED.plate_included,
    installation_required = EXCLUDED.installation_required,
    max_addresses = EXCLUDED.max_addresses
WHERE ROW(
    public.cms_plans.name, public.cms_plans.description, public.cms_plans.features,
    public.cms_plans.price_gnf, public.cms_plans.period, public.cms_plans.popular,
    public.cms_plans.active, public.cms_plans.position, public.cms_plans.audience,
    public.cms_plans.price_from_gnf, public.cms_plans.price_to_gnf,
    public.cms_plans.recurring_price_gnf, public.cms_plans.billing_period,
    public.cms_plans.requires_quote, public.cms_plans.plate_available,
    public.cms_plans.plate_included, public.cms_plans.installation_required,
    public.cms_plans.max_addresses
) IS DISTINCT FROM ROW(
    EXCLUDED.name, EXCLUDED.description, EXCLUDED.features, EXCLUDED.price_gnf,
    EXCLUDED.period, EXCLUDED.popular, EXCLUDED.active, EXCLUDED.position,
    EXCLUDED.audience, EXCLUDED.price_from_gnf, EXCLUDED.price_to_gnf,
    EXCLUDED.recurring_price_gnf, EXCLUDED.billing_period, EXCLUDED.requires_quote,
    EXCLUDED.plate_available, EXCLUDED.plate_included, EXCLUDED.installation_required,
    EXCLUDED.max_addresses
);

INSERT INTO public.cms_plans (
    code, name, description, features, price_gnf, period, popular, active, position,
    audience, price_from_gnf, price_to_gnf, recurring_price_gnf, billing_period,
    requires_quote, plate_available, plate_included, installation_required, max_addresses
)
VALUES (
    'numerique',
    '{"en": "Digital only", "fr": "Numérique seule"}'::jsonb,
    '{"en": "Digital GN address with unique number, QR code and GPS location.", "fr": "Adresse GN numérique avec numéro unique, QR Code et localisation GPS."}'::jsonb,
    '{"fr": ["Numéro Adresse GN", "QR Code", "Localisation GPS", "Google Maps / Waze", "Partage de l’adresse"]}'::jsonb,
    40000,
    'once',
    FALSE,
    TRUE,
    10,
    'individual',
    30000,
    50000,
    0,
    'none',
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    NULL
)
ON CONFLICT (code) DO UPDATE
SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    features = EXCLUDED.features,
    price_gnf = EXCLUDED.price_gnf,
    period = EXCLUDED.period,
    popular = EXCLUDED.popular,
    active = EXCLUDED.active,
    position = EXCLUDED.position,
    audience = EXCLUDED.audience,
    price_from_gnf = EXCLUDED.price_from_gnf,
    price_to_gnf = EXCLUDED.price_to_gnf,
    recurring_price_gnf = EXCLUDED.recurring_price_gnf,
    billing_period = EXCLUDED.billing_period,
    requires_quote = EXCLUDED.requires_quote,
    plate_available = EXCLUDED.plate_available,
    plate_included = EXCLUDED.plate_included,
    installation_required = EXCLUDED.installation_required,
    max_addresses = EXCLUDED.max_addresses
WHERE ROW(
    public.cms_plans.name, public.cms_plans.description, public.cms_plans.features,
    public.cms_plans.price_gnf, public.cms_plans.period, public.cms_plans.popular,
    public.cms_plans.active, public.cms_plans.position, public.cms_plans.audience,
    public.cms_plans.price_from_gnf, public.cms_plans.price_to_gnf,
    public.cms_plans.recurring_price_gnf, public.cms_plans.billing_period,
    public.cms_plans.requires_quote, public.cms_plans.plate_available,
    public.cms_plans.plate_included, public.cms_plans.installation_required,
    public.cms_plans.max_addresses
) IS DISTINCT FROM ROW(
    EXCLUDED.name, EXCLUDED.description, EXCLUDED.features, EXCLUDED.price_gnf,
    EXCLUDED.period, EXCLUDED.popular, EXCLUDED.active, EXCLUDED.position,
    EXCLUDED.audience, EXCLUDED.price_from_gnf, EXCLUDED.price_to_gnf,
    EXCLUDED.recurring_price_gnf, EXCLUDED.billing_period, EXCLUDED.requires_quote,
    EXCLUDED.plate_available, EXCLUDED.plate_included, EXCLUDED.installation_required,
    EXCLUDED.max_addresses
);

INSERT INTO public.cms_plans (
    code, name, description, features, price_gnf, period, popular, active, position,
    audience, price_from_gnf, price_to_gnf, recurring_price_gnf, billing_period,
    requires_quote, plate_available, plate_included, installation_required, max_addresses
)
VALUES (
    'residentiel_standard',
    '{"en": "Residential Standard", "fr": "Résidentiel Standard"}'::jsonb,
    '{"en": "GN residential address with physical plate and location services.", "fr": "Adresse GN pour habitation avec plaque physique et services de localisation."}'::jsonb,
    '{"fr": ["Numéro Adresse GN", "QR Code", "Localisation GPS", "Plaque physique", "Google Maps / Waze"]}'::jsonb,
    150000,
    'once',
    TRUE,
    TRUE,
    20,
    'residential',
    150000,
    150000,
    0,
    'none',
    FALSE,
    TRUE,
    TRUE,
    TRUE,
    NULL
)
ON CONFLICT (code) DO UPDATE
SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    features = EXCLUDED.features,
    price_gnf = EXCLUDED.price_gnf,
    period = EXCLUDED.period,
    popular = EXCLUDED.popular,
    active = EXCLUDED.active,
    position = EXCLUDED.position,
    audience = EXCLUDED.audience,
    price_from_gnf = EXCLUDED.price_from_gnf,
    price_to_gnf = EXCLUDED.price_to_gnf,
    recurring_price_gnf = EXCLUDED.recurring_price_gnf,
    billing_period = EXCLUDED.billing_period,
    requires_quote = EXCLUDED.requires_quote,
    plate_available = EXCLUDED.plate_available,
    plate_included = EXCLUDED.plate_included,
    installation_required = EXCLUDED.installation_required,
    max_addresses = EXCLUDED.max_addresses
WHERE ROW(
    public.cms_plans.name, public.cms_plans.description, public.cms_plans.features,
    public.cms_plans.price_gnf, public.cms_plans.period, public.cms_plans.popular,
    public.cms_plans.active, public.cms_plans.position, public.cms_plans.audience,
    public.cms_plans.price_from_gnf, public.cms_plans.price_to_gnf,
    public.cms_plans.recurring_price_gnf, public.cms_plans.billing_period,
    public.cms_plans.requires_quote, public.cms_plans.plate_available,
    public.cms_plans.plate_included, public.cms_plans.installation_required,
    public.cms_plans.max_addresses
) IS DISTINCT FROM ROW(
    EXCLUDED.name, EXCLUDED.description, EXCLUDED.features, EXCLUDED.price_gnf,
    EXCLUDED.period, EXCLUDED.popular, EXCLUDED.active, EXCLUDED.position,
    EXCLUDED.audience, EXCLUDED.price_from_gnf, EXCLUDED.price_to_gnf,
    EXCLUDED.recurring_price_gnf, EXCLUDED.billing_period, EXCLUDED.requires_quote,
    EXCLUDED.plate_available, EXCLUDED.plate_included, EXCLUDED.installation_required,
    EXCLUDED.max_addresses
);

INSERT INTO public.cms_plans (
    code, name, description, features, price_gnf, period, popular, active, position,
    audience, price_from_gnf, price_to_gnf, recurring_price_gnf, billing_period,
    requires_quote, plate_available, plate_included, installation_required, max_addresses
)
VALUES (
    'basic',
    '{"en": "Basic — legacy plan", "fr": "Basic — ancienne offre"}'::jsonb,
    '{"en": "Legacy plan retained for existing orders.", "fr": "Ancienne formule conservée pour compatibilité avec les commandes existantes."}'::jsonb,
    '{}'::jsonb,
    50000,
    'once',
    FALSE,
    FALSE,
    900,
    'legacy',
    50000,
    50000,
    0,
    'none',
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    NULL
)
ON CONFLICT (code) DO UPDATE
SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    features = EXCLUDED.features,
    price_gnf = EXCLUDED.price_gnf,
    period = EXCLUDED.period,
    popular = EXCLUDED.popular,
    active = EXCLUDED.active,
    position = EXCLUDED.position,
    audience = EXCLUDED.audience,
    price_from_gnf = EXCLUDED.price_from_gnf,
    price_to_gnf = EXCLUDED.price_to_gnf,
    recurring_price_gnf = EXCLUDED.recurring_price_gnf,
    billing_period = EXCLUDED.billing_period,
    requires_quote = EXCLUDED.requires_quote,
    plate_available = EXCLUDED.plate_available,
    plate_included = EXCLUDED.plate_included,
    installation_required = EXCLUDED.installation_required,
    max_addresses = EXCLUDED.max_addresses
WHERE ROW(
    public.cms_plans.name, public.cms_plans.description, public.cms_plans.features,
    public.cms_plans.price_gnf, public.cms_plans.period, public.cms_plans.popular,
    public.cms_plans.active, public.cms_plans.position, public.cms_plans.audience,
    public.cms_plans.price_from_gnf, public.cms_plans.price_to_gnf,
    public.cms_plans.recurring_price_gnf, public.cms_plans.billing_period,
    public.cms_plans.requires_quote, public.cms_plans.plate_available,
    public.cms_plans.plate_included, public.cms_plans.installation_required,
    public.cms_plans.max_addresses
) IS DISTINCT FROM ROW(
    EXCLUDED.name, EXCLUDED.description, EXCLUDED.features, EXCLUDED.price_gnf,
    EXCLUDED.period, EXCLUDED.popular, EXCLUDED.active, EXCLUDED.position,
    EXCLUDED.audience, EXCLUDED.price_from_gnf, EXCLUDED.price_to_gnf,
    EXCLUDED.recurring_price_gnf, EXCLUDED.billing_period, EXCLUDED.requires_quote,
    EXCLUDED.plate_available, EXCLUDED.plate_included, EXCLUDED.installation_required,
    EXCLUDED.max_addresses
);

INSERT INTO public.cms_plans (
    code, name, description, features, price_gnf, period, popular, active, position,
    audience, price_from_gnf, price_to_gnf, recurring_price_gnf, billing_period,
    requires_quote, plate_available, plate_included, installation_required, max_addresses
)
VALUES (
    'plus',
    '{"en": "Plus — legacy plan", "fr": "Plus — ancienne offre"}'::jsonb,
    '{"en": "Legacy plan retained for existing orders.", "fr": "Ancienne formule conservée pour compatibilité avec les commandes existantes."}'::jsonb,
    '{}'::jsonb,
    750000,
    'once',
    FALSE,
    FALSE,
    910,
    'legacy',
    750000,
    750000,
    0,
    'none',
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    NULL
)
ON CONFLICT (code) DO UPDATE
SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    features = EXCLUDED.features,
    price_gnf = EXCLUDED.price_gnf,
    period = EXCLUDED.period,
    popular = EXCLUDED.popular,
    active = EXCLUDED.active,
    position = EXCLUDED.position,
    audience = EXCLUDED.audience,
    price_from_gnf = EXCLUDED.price_from_gnf,
    price_to_gnf = EXCLUDED.price_to_gnf,
    recurring_price_gnf = EXCLUDED.recurring_price_gnf,
    billing_period = EXCLUDED.billing_period,
    requires_quote = EXCLUDED.requires_quote,
    plate_available = EXCLUDED.plate_available,
    plate_included = EXCLUDED.plate_included,
    installation_required = EXCLUDED.installation_required,
    max_addresses = EXCLUDED.max_addresses
WHERE ROW(
    public.cms_plans.name, public.cms_plans.description, public.cms_plans.features,
    public.cms_plans.price_gnf, public.cms_plans.period, public.cms_plans.popular,
    public.cms_plans.active, public.cms_plans.position, public.cms_plans.audience,
    public.cms_plans.price_from_gnf, public.cms_plans.price_to_gnf,
    public.cms_plans.recurring_price_gnf, public.cms_plans.billing_period,
    public.cms_plans.requires_quote, public.cms_plans.plate_available,
    public.cms_plans.plate_included, public.cms_plans.installation_required,
    public.cms_plans.max_addresses
) IS DISTINCT FROM ROW(
    EXCLUDED.name, EXCLUDED.description, EXCLUDED.features, EXCLUDED.price_gnf,
    EXCLUDED.period, EXCLUDED.popular, EXCLUDED.active, EXCLUDED.position,
    EXCLUDED.audience, EXCLUDED.price_from_gnf, EXCLUDED.price_to_gnf,
    EXCLUDED.recurring_price_gnf, EXCLUDED.billing_period, EXCLUDED.requires_quote,
    EXCLUDED.plate_available, EXCLUDED.plate_included, EXCLUDED.installation_required,
    EXCLUDED.max_addresses
);

-- ---------------------------------------------------------------------
-- 12. Postconditions
-- ---------------------------------------------------------------------

DO $phase14b1_postconditions$
DECLARE
    v_plan_count integer;
BEGIN
    IF to_regclass('public.order_sites') IS NULL THEN
        RAISE EXCEPTION
            'Phase14B1: order_sites missing';
    END IF;

    IF to_regclass('public.order_events') IS NULL THEN
        RAISE EXCEPTION
            'Phase14B1: order_events missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n
            ON n.oid = p.pronamespace
        WHERE
            n.nspname = 'public'
            AND p.proname = 'submit_address_order_v1'
    ) THEN
        RAISE EXCEPTION
            'Phase14B1: checkout RPC missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_class c
            ON c.oid = t.tgrelid
        JOIN pg_namespace n
            ON n.oid = c.relnamespace
        WHERE
            n.nspname = 'public'
            AND c.relname = 'orders'
            AND t.tgname = 'trg_orders_status_event_v1'
            AND NOT t.tgisinternal
    ) THEN
        RAISE EXCEPTION
            'Phase14B1: order status trigger missing';
    END IF;

    SELECT COUNT(*)
    INTO v_plan_count
    FROM public.cms_plans;

    IF v_plan_count < 6 THEN
        RAISE EXCEPTION
            'Phase14B1: plan catalogue incomplete: %',
            v_plan_count;
    END IF;
END
$phase14b1_postconditions$;
