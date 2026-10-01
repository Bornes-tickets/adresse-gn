-- ============================================================================
-- PHASE 16C3 / G3-C2-C12-D1
-- Traçabilité permanente des remplacements de beacons.
--
-- Objectif :
-- préserver explicitement la relation entre un beacon legacy et son
-- remplaçant V1 sans supprimer ni renommer le beacon historique.
--
-- Cette migration :
-- - crée uniquement la structure de traçabilité ;
-- - ne modifie aucun beacon ;
-- - ne modifie aucune adresse ;
-- - ne consomme aucune valeur de séquence.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.beacon_replacements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    legacy_beacon_id uuid NOT NULL,
    v1_beacon_id uuid NOT NULL,

    reason text NOT NULL DEFAULT 'legacy_v1_migration',

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT beacon_replacements_legacy_fkey
        FOREIGN KEY (legacy_beacon_id)
        REFERENCES public.beacons(id)
        ON DELETE RESTRICT,

    CONSTRAINT beacon_replacements_v1_fkey
        FOREIGN KEY (v1_beacon_id)
        REFERENCES public.beacons(id)
        ON DELETE RESTRICT,

    CONSTRAINT beacon_replacements_legacy_unique
        UNIQUE (legacy_beacon_id),

    CONSTRAINT beacon_replacements_v1_unique
        UNIQUE (v1_beacon_id),

    CONSTRAINT beacon_replacements_distinct_check
        CHECK (legacy_beacon_id <> v1_beacon_id),

    CONSTRAINT beacon_replacements_reason_check
        CHECK (
            reason IN (
                'legacy_v1_migration',
                'replacement'
            )
        )
);

CREATE INDEX IF NOT EXISTS
    idx_beacon_replacements_created_at
ON public.beacon_replacements (
    created_at DESC
);

COMMIT;