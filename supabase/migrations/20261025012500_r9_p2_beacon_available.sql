-- R9-P2 — OPS procurement / stock availability
-- Forward-only constraint extension.
-- No existing row is rewritten by this migration.

ALTER TABLE public.beacons
DROP CONSTRAINT IF EXISTS beacons_status_check;

ALTER TABLE public.beacons
ADD CONSTRAINT beacons_status_check
CHECK (
    status = ANY (
        ARRAY[
            'generated'::text,
            'available'::text,
            'assigned'::text,
            'installed'::text,
            'active'::text,
            'suspended'::text,
            'replaced'::text,
            'cancelled'::text
        ]
    )
);
