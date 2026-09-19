-- =====================================================================
-- Phase 14C6B — Payment hardening before Django cutover
-- =====================================================================

ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE public.payments
SET created_at = now()
WHERE created_at IS NULL;

ALTER TABLE public.payments
    ALTER COLUMN created_at SET DEFAULT now(),
    ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE public.payments
    ALTER COLUMN order_id SET NOT NULL,
    ALTER COLUMN provider SET NOT NULL;

ALTER TABLE public.payments
    DROP CONSTRAINT IF EXISTS payments_amount_nonnegative;

ALTER TABLE public.payments
    ADD CONSTRAINT payments_amount_nonnegative
    CHECK (amount_gnf >= 0);

CREATE INDEX IF NOT EXISTS idx_payments_order_created
ON public.payments(order_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_payments_pending_order_provider
ON public.payments(order_id, provider)
WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS ux_payments_provider_intent
ON public.payments(provider, intent_id)
WHERE intent_id IS NOT NULL AND btrim(intent_id) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_payments_provider_external_ref
ON public.payments(provider, external_ref)
WHERE external_ref IS NOT NULL AND btrim(external_ref) <> '';

ALTER TABLE public.payment_webhooks
    ADD COLUMN IF NOT EXISTS event_key text;

ALTER TABLE public.payment_webhooks
    DROP CONSTRAINT IF EXISTS payment_webhooks_event_key_nonblank;

ALTER TABLE public.payment_webhooks
    ADD CONSTRAINT payment_webhooks_event_key_nonblank
    CHECK (event_key IS NULL OR btrim(event_key) <> '');

CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_webhooks_provider_event_key
ON public.payment_webhooks(provider, event_key)
WHERE event_key IS NOT NULL;

ALTER TABLE public.pending_installations
    DROP CONSTRAINT IF EXISTS pending_installations_status_check;

ALTER TABLE public.pending_installations
    ADD CONSTRAINT pending_installations_status_check
    CHECK (
        status = ANY (
            ARRAY[
                'pending'::text,
                'assigned'::text,
                'planned'::text,
                'done'::text,
                'cancelled'::text
            ]
        )
    );

CREATE INDEX IF NOT EXISTS idx_pending_installations_order
ON public.pending_installations(order_id);

REVOKE ALL PRIVILEGES
ON TABLE public.pending_installations
FROM anon;

REVOKE
    INSERT,
    UPDATE,
    DELETE,
    TRUNCATE,
    REFERENCES,
    TRIGGER
ON TABLE public.pending_installations
FROM authenticated;

GRANT SELECT
ON TABLE public.pending_installations
TO authenticated;

GRANT ALL PRIVILEGES
ON TABLE public.pending_installations
TO service_role;

UPDATE public.orders o
SET items = jsonb_build_array(
    jsonb_build_object(
        'qty',
        COALESCE(
            NULLIF(
                (o.items -> 0 ->> 'qty')::integer,
                0
            ),
            1
        ),
        'ref',
        o.offer_code,
        'code',
        o.offer_code,
        'label',
        COALESCE(
            NULLIF(
                o.items -> 0 ->> 'label',
                ''
            ),
            NULLIF(
                o.formule_label,
                ''
            ),
            o.offer_code
        ),
        'unit_price_gnf',
        o.amount_gnf,
        'fulfillment_kind',
        p.fulfillment_kind
    )
)
FROM public.cms_plans p
WHERE
    p.id = o.plan_id
    AND p.fulfillment_kind IN (
        'digital_address',
        'physical_installation'
    )
    AND jsonb_array_length(
        COALESCE(
            o.items,
            '[]'::jsonb
        )
    ) = 1
    AND (
        NOT (o.items -> 0 ? 'fulfillment_kind')
        OR NOT (o.items -> 0 ? 'unit_price_gnf')
        OR NOT (o.items -> 0 ? 'ref')
    );

DO $phase14c6b_postconditions$
DECLARE
    v_bad_payment bigint;
    v_bad_pending bigint;
    v_bad_direct_items bigint;
    v_auth_pending_write boolean;
    v_anon_pending_any boolean;
BEGIN
    SELECT COUNT(*)
    INTO v_bad_payment
    FROM public.payments
    WHERE
        order_id IS NULL
        OR provider IS NULL
        OR created_at IS NULL
        OR amount_gnf < 0;

    IF v_bad_payment <> 0 THEN
        RAISE EXCEPTION
            'Phase14C6B: invalid payments remain: %',
            v_bad_payment;
    END IF;

    SELECT COUNT(*)
    INTO v_bad_pending
    FROM public.pending_installations
    WHERE status NOT IN (
        'pending',
        'assigned',
        'planned',
        'done',
        'cancelled'
    );

    IF v_bad_pending <> 0 THEN
        RAISE EXCEPTION
            'Phase14C6B: invalid pending installation status remains: %',
            v_bad_pending;
    END IF;

    SELECT COUNT(*)
    INTO v_bad_direct_items
    FROM public.orders o
    JOIN public.cms_plans p
      ON p.id = o.plan_id
    WHERE
        p.fulfillment_kind IN (
            'digital_address',
            'physical_installation'
        )
        AND (
            jsonb_array_length(
                COALESCE(
                    o.items,
                    '[]'::jsonb
                )
            ) <> 1
            OR NOT (o.items -> 0 ? 'fulfillment_kind')
            OR NOT (o.items -> 0 ? 'unit_price_gnf')
            OR NOT (o.items -> 0 ? 'ref')
        );

    IF v_bad_direct_items <> 0 THEN
        RAISE EXCEPTION
            'Phase14C6B: non-canonical direct-pay items remain: %',
            v_bad_direct_items;
    END IF;

    SELECT
        has_table_privilege(
            'authenticated',
            'public.pending_installations',
            'INSERT'
        )
        OR has_table_privilege(
            'authenticated',
            'public.pending_installations',
            'UPDATE'
        )
        OR has_table_privilege(
            'authenticated',
            'public.pending_installations',
            'DELETE'
        )
    INTO v_auth_pending_write;

    IF v_auth_pending_write THEN
        RAISE EXCEPTION
            'Phase14C6B: authenticated direct writes remain on pending_installations';
    END IF;

    SELECT
        has_table_privilege(
            'anon',
            'public.pending_installations',
            'SELECT'
        )
        OR has_table_privilege(
            'anon',
            'public.pending_installations',
            'INSERT'
        )
        OR has_table_privilege(
            'anon',
            'public.pending_installations',
            'UPDATE'
        )
        OR has_table_privilege(
            'anon',
            'public.pending_installations',
            'DELETE'
        )
    INTO v_anon_pending_any;

    IF v_anon_pending_any THEN
        RAISE EXCEPTION
            'Phase14C6B: anon privileges remain on pending_installations';
    END IF;
END
$phase14c6b_postconditions$;
