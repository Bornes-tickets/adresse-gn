-- ============ A1. orders ============
CREATE SEQUENCE IF NOT EXISTS public.order_ref_seq;
CREATE SEQUENCE IF NOT EXISTS public.invoice_ref_seq;

CREATE OR REPLACE FUNCTION public.next_order_ref()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((nextval('public.order_ref_seq') % 10000)::text, 4, '0');
$$;

CREATE OR REPLACE FUNCTION public.next_invoice_ref()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((nextval('public.invoice_ref_seq') % 10000)::text, 4, '0');
$$;

REVOKE ALL ON FUNCTION public.next_order_ref() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_invoice_ref() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_ref TEXT,
  ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS beacon_id UUID REFERENCES public.beacons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.business_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE public.orders SET order_ref = public.next_order_ref() WHERE order_ref IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN order_ref SET DEFAULT public.next_order_ref();
ALTER TABLE public.orders
  ALTER COLUMN order_ref SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_ref_key ON public.orders(order_ref);
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders(status);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON public.orders(customer_id);

-- ============ A1. payments ============
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS intent_id TEXT,
  ADD COLUMN IF NOT EXISTS webhook_payload JSONB,
  ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments(status);
CREATE INDEX IF NOT EXISTS payments_intent_idx ON public.payments(intent_id);

-- ============ A1. subscriptions ============
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS next_billing_date DATE;

UPDATE public.subscriptions SET next_billing_date = end_date WHERE next_billing_date IS NULL;

-- ============ A1. invoices ============
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS amount_gnf BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'issued',
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_status_check'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_status_check CHECK (status IN ('issued','paid','void'));
  END IF;
END $$;

-- ============ A2. payment_webhooks ============
CREATE TABLE IF NOT EXISTS public.payment_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  headers JSONB,
  payload JSONB,
  signature_valid BOOLEAN NOT NULL DEFAULT false,
  processed BOOLEAN NOT NULL DEFAULT false,
  error TEXT
);

GRANT SELECT ON public.payment_webhooks TO authenticated;
GRANT ALL ON public.payment_webhooks TO service_role;
ALTER TABLE public.payment_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_webhooks_admin_select" ON public.payment_webhooks;
CREATE POLICY "payment_webhooks_admin_select" ON public.payment_webhooks
  FOR SELECT TO authenticated
  USING (private.current_role_is(ARRAY['admin','supervisor']));

CREATE INDEX IF NOT EXISTS payment_webhooks_provider_idx ON public.payment_webhooks(provider, received_at DESC);

-- ============ E12. pending_installations ============
CREATE TABLE IF NOT EXISTS public.pending_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beacon_id UUID REFERENCES public.beacons(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  phone TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pending_installations TO authenticated;
GRANT INSERT, UPDATE ON public.pending_installations TO authenticated;
GRANT ALL ON public.pending_installations TO service_role;
ALTER TABLE public.pending_installations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pending_installations_own_select" ON public.pending_installations;
CREATE POLICY "pending_installations_own_select" ON public.pending_installations
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR private.current_role_is(ARRAY['admin','supervisor','agent']));

DROP POLICY IF EXISTS "pending_installations_admin_update" ON public.pending_installations;
CREATE POLICY "pending_installations_admin_update" ON public.pending_installations
  FOR UPDATE TO authenticated
  USING (private.current_role_is(ARRAY['admin','supervisor']))
  WITH CHECK (private.current_role_is(ARRAY['admin','supervisor']));

DROP POLICY IF EXISTS "pending_installations_admin_insert" ON public.pending_installations;
CREATE POLICY "pending_installations_admin_insert" ON public.pending_installations
  FOR INSERT TO authenticated
  WITH CHECK (private.current_role_is(ARRAY['admin','supervisor']));

CREATE INDEX IF NOT EXISTS pending_installations_status_idx ON public.pending_installations(status, created_at DESC);

CREATE TRIGGER update_pending_installations_updated_at
  BEFORE UPDATE ON public.pending_installations
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ orders: permettre au client de créer sa commande ============
GRANT SELECT, INSERT ON public.orders TO authenticated;
DROP POLICY IF EXISTS "orders_own_insert" ON public.orders;
CREATE POLICY "orders_own_insert" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());
