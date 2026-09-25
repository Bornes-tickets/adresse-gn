-- Phase 15G2B0 — Invoice idempotence hardening
-- Guarantee at most one invoice per non-null order_id.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.invoices
    WHERE order_id IS NOT NULL
    GROUP BY order_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate invoices.order_id detected; aborting 15G2B0';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_invoices_order_id_not_null
  ON public.invoices(order_id)
  WHERE order_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'invoices'
      AND indexname = 'ux_invoices_order_id_not_null'
  ) THEN
    RAISE EXCEPTION
      'ux_invoices_order_id_not_null was not created';
  END IF;
END
$$;
