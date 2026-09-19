-- =====================================================================
-- Phase 14B2 — Checkout normalization
-- Scope intentionally limited to:
--   orders / order_sites / order_events / payments
-- Other legacy commercial/qc policies are intentionally left unchanged.
-- =====================================================================

UPDATE public.orders
SET client_type = 'institutionnel'
WHERE client_type = 'institution';

UPDATE public.orders
SET payment_method = 'orange'
WHERE payment_method = 'orange_money';

ALTER TABLE public.payments
DROP CONSTRAINT IF EXISTS payments_provider_check;

ALTER TABLE public.payments
ADD CONSTRAINT payments_provider_check
CHECK (
    provider = ANY (
        ARRAY[
            'manual'::text,
            'orange'::text,
            'mtn'::text,
            'card'::text,
            'cash'::text,
            'transfer'::text
        ]
    )
);

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
  v_client_type text;
  v_payment_method text;
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


  v_client_type := lower(
    btrim(
      coalesce(
        p_client_type,
        ''
      )
    )
  );

  if v_client_type = 'institution' then
    v_client_type := 'institutionnel';
  end if;

  if v_client_type not in (
    'particulier',
    'professionnel',
    'institutionnel'
  ) then
    raise exception 'INVALID_CLIENT_TYPE';
  end if;

  v_payment_method := nullif(
    lower(
      btrim(
        coalesce(
          p_payment_method,
          ''
        )
      )
    ),
    ''
  );

  v_payment_method := case v_payment_method
    when 'orange_money' then 'orange'
    when 'mtn_money' then 'mtn'
    when 'carte_bancaire' then 'card'
    when 'virement' then 'transfer'
    else v_payment_method
  end;

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

    v_client_type,
    p_full_name,
    v_contact_phone,
    v_contact_email,

    p_address_line,

    1,
    coalesce(p_devis_demande, false),

    v_plan.code,
    v_label,
    v_plan.price_gnf,

    v_payment_method,

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


DROP POLICY IF EXISTS "customer read orders"
ON public.orders;

CREATE POLICY "customer read orders"
ON public.orders
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
    (
        SELECT private.current_account_is_active()
    )
    AND (
        customer_id = auth.uid()
        OR private.current_role_is(
            ARRAY[
                'admin'::text,
                'sales'::text,
                'super_admin'::text
            ]
        )
    )
);

DROP POLICY IF EXISTS "customer read own order sites"
ON public.order_sites;

CREATE POLICY "customer read own order sites"
ON public.order_sites
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
    (
        SELECT private.current_account_is_active()
    )
    AND (
        EXISTS (
            SELECT 1
            FROM public.orders o
            WHERE
                o.id = order_sites.order_id
                AND o.customer_id = auth.uid()
        )
        OR private.current_role_is(
            ARRAY[
                'sales'::text,
                'supervisor'::text,
                'admin'::text,
                'super_admin'::text
            ]
        )
        OR (
            private.current_role_is(
                ARRAY['agent'::text]
            )
            AND EXISTS (
                SELECT 1
                FROM public.beacons b
                WHERE
                    b.id = order_sites.beacon_id
                    AND b.assigned_agent_id = auth.uid()
            )
        )
    )
);

DROP POLICY IF EXISTS "customer read own order events"
ON public.order_events;

CREATE POLICY "customer read own order events"
ON public.order_events
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
    (
        SELECT private.current_account_is_active()
    )
    AND (
        EXISTS (
            SELECT 1
            FROM public.orders o
            WHERE
                o.id = order_events.order_id
                AND o.customer_id = auth.uid()
        )
        OR private.current_role_is(
            ARRAY[
                'sales'::text,
                'supervisor'::text,
                'admin'::text,
                'super_admin'::text
            ]
        )
    )
);

DROP POLICY IF EXISTS "customer read payments"
ON public.payments;

CREATE POLICY "customer read payments"
ON public.payments
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
    (
        SELECT private.current_account_is_active()
    )
    AND EXISTS (
        SELECT 1
        FROM public.orders o
        WHERE
            o.id = payments.order_id
            AND (
                o.customer_id = auth.uid()
                OR private.current_role_is(
                    ARRAY[
                        'admin'::text,
                        'sales'::text,
                        'super_admin'::text
                    ]
                )
            )
    )
);

REVOKE ALL PRIVILEGES
ON TABLE public.order_sites
FROM anon;

REVOKE
    INSERT,
    UPDATE,
    DELETE,
    TRUNCATE,
    REFERENCES,
    TRIGGER
ON TABLE public.order_sites
FROM authenticated;

GRANT SELECT
ON TABLE public.order_sites
TO authenticated;

GRANT ALL PRIVILEGES
ON TABLE public.order_sites
TO service_role;

REVOKE ALL PRIVILEGES
ON TABLE public.order_events
FROM anon;

REVOKE
    INSERT,
    UPDATE,
    DELETE,
    TRUNCATE,
    REFERENCES,
    TRIGGER
ON TABLE public.order_events
FROM authenticated;

GRANT SELECT
ON TABLE public.order_events
TO authenticated;

GRANT ALL PRIVILEGES
ON TABLE public.order_events
TO service_role;

REVOKE ALL PRIVILEGES
ON TABLE public.payments
FROM anon;

REVOKE
    INSERT,
    UPDATE,
    DELETE,
    TRUNCATE,
    REFERENCES,
    TRIGGER
ON TABLE public.payments
FROM authenticated;

GRANT SELECT
ON TABLE public.payments
TO authenticated;

GRANT ALL PRIVILEGES
ON TABLE public.payments
TO service_role;

DO $phase14b2_postconditions$
DECLARE
    v_checkout_legacy integer;
    v_provider_constraint text;
BEGIN
    SELECT COUNT(*)
    INTO v_checkout_legacy
    FROM pg_policies
    WHERE
        schemaname = 'public'
        AND tablename = ANY(
            ARRAY[
                'orders',
                'order_sites',
                'order_events',
                'payments'
            ]
        )
        AND (
            POSITION(
                'commercial'
                IN COALESCE(qual, '')
            ) > 0
            OR POSITION(
                'commercial'
                IN COALESCE(with_check, '')
            ) > 0
            OR POSITION(
                chr(39) || 'qc' || chr(39)
                IN COALESCE(qual, '')
            ) > 0
            OR POSITION(
                chr(39) || 'qc' || chr(39)
                IN COALESCE(with_check, '')
            ) > 0
        );

    IF v_checkout_legacy <> 0 THEN
        RAISE EXCEPTION
            'Phase14B2: checkout legacy policies remain: %',
            v_checkout_legacy;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.orders
        WHERE
            client_type = 'institution'
            OR payment_method = 'orange_money'
    ) THEN
        RAISE EXCEPTION
            'Phase14B2: legacy order vocabulary remains';
    END IF;

    SELECT pg_get_constraintdef(c.oid, true)
    INTO v_provider_constraint
    FROM pg_constraint c
    JOIN pg_class t
        ON t.oid = c.conrelid
    JOIN pg_namespace n
        ON n.oid = t.relnamespace
    WHERE
        n.nspname = 'public'
        AND t.relname = 'payments'
        AND c.conname = 'payments_provider_check'
    LIMIT 1;

    IF v_provider_constraint IS NULL
       OR POSITION(
            chr(39) || 'manual' || chr(39)
            IN v_provider_constraint
       ) = 0 THEN
        RAISE EXCEPTION
            'Phase14B2: manual provider not allowed';
    END IF;

    IF has_table_privilege(
        'anon',
        'public.order_sites',
        'SELECT'
    )
    OR has_table_privilege(
        'anon',
        'public.order_events',
        'SELECT'
    )
    OR has_table_privilege(
        'anon',
        'public.payments',
        'SELECT'
    ) THEN
        RAISE EXCEPTION
            'Phase14B2: anon checkout table access remains';
    END IF;

    IF has_table_privilege(
        'authenticated',
        'public.order_sites',
        'INSERT'
    )
    OR has_table_privilege(
        'authenticated',
        'public.order_events',
        'INSERT'
    )
    OR has_table_privilege(
        'authenticated',
        'public.payments',
        'INSERT'
    ) THEN
        RAISE EXCEPTION
            'Phase14B2: authenticated direct checkout writes remain';
    END IF;

    IF NOT has_table_privilege(
        'authenticated',
        'public.order_sites',
        'SELECT'
    )
    OR NOT has_table_privilege(
        'authenticated',
        'public.order_events',
        'SELECT'
    )
    OR NOT has_table_privilege(
        'authenticated',
        'public.payments',
        'SELECT'
    ) THEN
        RAISE EXCEPTION
            'Phase14B2: authenticated checkout reads missing';
    END IF;
END
$phase14b2_postconditions$;
