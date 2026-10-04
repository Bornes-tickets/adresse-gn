-- C6-C2-C6-A5-R11-IMPLEMENT-A1
-- Additive core for Django physical fulfillment. Legacy rows are preserved.

BEGIN;

ALTER TABLE public.addresses
    ADD COLUMN IF NOT EXISTS sector_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'addresses_sector_id_fkey'
          AND conrelid = 'public.addresses'::regclass
    ) THEN
        ALTER TABLE public.addresses
            ADD CONSTRAINT addresses_sector_id_fkey
            FOREIGN KEY (sector_id)
            REFERENCES public.sectors(id)
            ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_addresses_sector
    ON public.addresses (sector_id);

ALTER TABLE public.pending_installations
    ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
    ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS
    pending_installations_one_per_order_uidx
    ON public.pending_installations (order_id)
    WHERE order_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'pending_installations_completed_state_check'
          AND conrelid = 'public.pending_installations'::regclass
    ) THEN
        ALTER TABLE public.pending_installations
            ADD CONSTRAINT pending_installations_completed_state_check
            CHECK (
                (status = 'done' AND completed_at IS NOT NULL)
                OR
                (status <> 'done' AND completed_at IS NULL)
            );
    END IF;
END
$$;

COMMIT;
