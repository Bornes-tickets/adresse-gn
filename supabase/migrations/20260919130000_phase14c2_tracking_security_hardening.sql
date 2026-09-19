-- Phase 14C2 — tracking/payment hardening
-- 1) Future guest_token values become URL-safe without changing token length.
-- 2) invoices/payment_webhooks are reduced to least-privilege table grants.
-- 3) invoices SELECT policy uses the canonical 'sales' role instead of legacy 'commercial'.

BEGIN;

-- ---------------------------------------------------------------------
-- orders.guest_token
-- ---------------------------------------------------------------------

ALTER TABLE public.orders
  ALTER COLUMN guest_token
  SET DEFAULT translate(
    encode(gen_random_bytes(12), 'base64'),
    '+/',
    '-_'
  );

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_guest_token_urlsafe_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_guest_token_urlsafe_check
  CHECK (
    guest_token ~ '^[A-Za-z0-9_-]{16}$'
  ) NOT VALID;

ALTER TABLE public.orders
  VALIDATE CONSTRAINT orders_guest_token_urlsafe_check;

-- ---------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------

REVOKE ALL PRIVILEGES
  ON TABLE public.invoices
  FROM anon, authenticated;

GRANT SELECT
  ON TABLE public.invoices
  TO authenticated;

GRANT ALL PRIVILEGES
  ON TABLE public.invoices
  TO service_role;

DROP POLICY IF EXISTS "customer read invoices"
  ON public.invoices;

CREATE POLICY "customer read invoices"
  ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    (
      SELECT private.current_account_is_active()
    )
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = invoices.order_id
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

-- ---------------------------------------------------------------------
-- payment_webhooks
-- ---------------------------------------------------------------------

REVOKE ALL PRIVILEGES
  ON TABLE public.payment_webhooks
  FROM anon, authenticated;

GRANT SELECT
  ON TABLE public.payment_webhooks
  TO authenticated;

GRANT ALL PRIVILEGES
  ON TABLE public.payment_webhooks
  TO service_role;

DROP POLICY IF EXISTS "payment_webhooks_admin_select"
  ON public.payment_webhooks;

CREATE POLICY "payment_webhooks_admin_select"
  ON public.payment_webhooks
  FOR SELECT
  TO authenticated
  USING (
    private.current_role_is(
      ARRAY[
        'admin'::text,
        'supervisor'::text
      ]
    )
  );

COMMIT;
