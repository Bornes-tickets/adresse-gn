BEGIN;

-- =====================================================================
-- Adresse GN — G3-C1-B3
-- Traçabilité de la désinstallation physique.
--
-- Une ligne installations reste l'historique de la pose.
-- La désinstallation complète cette ligne sans supprimer la pose.
--
-- Aucun backfill.
-- Aucune installation existante n'est déclarée démontée.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Métadonnées de désinstallation
-- ---------------------------------------------------------------------

ALTER TABLE public.installations
    ADD COLUMN IF NOT EXISTS uninstalled_at
        timestamptz,

    ADD COLUMN IF NOT EXISTS uninstalled_by_agent_id
        uuid,

    ADD COLUMN IF NOT EXISTS uninstall_reason
        text,

    ADD COLUMN IF NOT EXISTS uninstall_photo_url
        text;


-- ---------------------------------------------------------------------
-- 2. Agent ayant réalisé le retrait
-- ---------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
            'installations_uninstalled_by_agent_id_fkey'
          AND conrelid =
            'public.installations'::regclass
    ) THEN

        ALTER TABLE public.installations
            ADD CONSTRAINT
                installations_uninstalled_by_agent_id_fkey
            FOREIGN KEY (
                uninstalled_by_agent_id
            )
            REFERENCES public.agents(id);

    END IF;
END
$$;


-- ---------------------------------------------------------------------
-- 3. Cohérence temporelle
-- ---------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
            'installations_uninstalled_after_installed_check'
          AND conrelid =
            'public.installations'::regclass
    ) THEN

        ALTER TABLE public.installations
            ADD CONSTRAINT
                installations_uninstalled_after_installed_check
            CHECK (
                uninstalled_at IS NULL
                OR installed_at IS NULL
                OR uninstalled_at >= installed_at
            );

    END IF;
END
$$;


-- ---------------------------------------------------------------------
-- 4. Cohérence des métadonnées de retrait
--
-- Si aucune désinstallation :
--   toutes les métadonnées de retrait doivent être NULL.
--
-- Si désinstallation :
--   date + agent + motif non vide sont obligatoires.
--   la photo reste optionnelle.
-- ---------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
            'installations_uninstall_metadata_check'
          AND conrelid =
            'public.installations'::regclass
    ) THEN

        ALTER TABLE public.installations
            ADD CONSTRAINT
                installations_uninstall_metadata_check
            CHECK (
                (
                    uninstalled_at IS NULL
                    AND uninstalled_by_agent_id IS NULL
                    AND uninstall_reason IS NULL
                    AND uninstall_photo_url IS NULL
                )
                OR
                (
                    uninstalled_at IS NOT NULL
                    AND uninstalled_by_agent_id IS NOT NULL
                    AND uninstall_reason IS NOT NULL
                    AND btrim(uninstall_reason) <> ''
                )
            );

    END IF;
END
$$;


-- ---------------------------------------------------------------------
-- 5. Index des désinstallations
-- ---------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS
    idx_installations_uninstalled_at
ON public.installations (
    uninstalled_at DESC
)
WHERE uninstalled_at IS NOT NULL;


CREATE INDEX IF NOT EXISTS
    idx_installations_uninstalled_by_agent
ON public.installations (
    uninstalled_by_agent_id
)
WHERE uninstalled_by_agent_id IS NOT NULL;


-- ---------------------------------------------------------------------
-- 6. Une seule installation physiquement active par balise.
--
-- Plusieurs lignes historiques sont autorisées après désinstallation.
-- ---------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS
    installations_one_active_per_beacon_uidx
ON public.installations (
    beacon_id
)
WHERE
    beacon_id IS NOT NULL
    AND uninstalled_at IS NULL;


COMMIT;