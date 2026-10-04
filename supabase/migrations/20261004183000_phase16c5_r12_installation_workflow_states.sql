-- R12 operational physical installation workflow.
-- Adds an explicit `installed` intermediate state.
-- No business data is changed by this migration.

BEGIN;

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
                'installed'::text,
                'done'::text,
                'cancelled'::text
            ]
        )
    );

COMMENT ON COLUMN public.pending_installations.status IS
    'Operational workflow: pending -> assigned -> planned -> installed -> done; cancelled is terminal.';

COMMIT;
