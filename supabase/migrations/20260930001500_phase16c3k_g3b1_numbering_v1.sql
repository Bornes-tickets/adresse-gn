BEGIN;

-- Adresse GN V1
-- Format : CCCCC-NNNNNNNNC
--
-- CCCCC    = code officiel de commune
-- NNNNNNNN = identifiant national 8 chiffres
-- C        = clé Verhoeff
--
-- Les numéros legacy GN-XXX-NNNNNN restent inchangés.


ALTER TABLE public.beacons
    ADD COLUMN IF NOT EXISTS national_id varchar(8);

ALTER TABLE public.beacons
    ADD COLUMN IF NOT EXISTS check_digit varchar(1);

ALTER TABLE public.beacons
    ADD COLUMN IF NOT EXISTS commune_code_at_issue varchar(5);

ALTER TABLE public.beacons
    ADD COLUMN IF NOT EXISTS numbering_version varchar(16);


UPDATE public.beacons
SET numbering_version = 'legacy'
WHERE numbering_version IS NULL
  AND public_number ~ '^GN-[A-Z]{3}-[0-9]{6}$';


DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.beacons
        WHERE numbering_version IS NULL
    ) THEN
        RAISE EXCEPTION
            'Adresse GN V1: numbering_version indéterminable.';
    END IF;
END
$$;


ALTER TABLE public.beacons
    ALTER COLUMN numbering_version
    SET DEFAULT 'legacy';

ALTER TABLE public.beacons
    ALTER COLUMN numbering_version
    SET NOT NULL;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.beacons'::regclass
          AND conname = 'beacons_numbering_version_check'
    ) THEN
        ALTER TABLE public.beacons
        ADD CONSTRAINT beacons_numbering_version_check
        CHECK (
            numbering_version IN (
                'legacy',
                'v1'
            )
        );
    END IF;
END
$$;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.beacons'::regclass
          AND conname = 'beacons_numbering_fields_check'
    ) THEN
        ALTER TABLE public.beacons
        ADD CONSTRAINT beacons_numbering_fields_check
        CHECK (
            (
                numbering_version = 'legacy'
                AND national_id IS NULL
                AND check_digit IS NULL
                AND commune_code_at_issue IS NULL
                AND public_number
                    ~ '^GN-[A-Z]{3}-[0-9]{6}$'
            )
            OR
            (
                numbering_version = 'v1'
                AND national_id
                    ~ '^[0-9]{8}$'
                AND check_digit
                    ~ '^[0-9]$'
                AND commune_code_at_issue
                    ~ '^[A-Z]{3}[0-9]{2}$'
                AND public_number
                    ~ '^[A-Z]{3}[0-9]{2}-[0-9]{9}$'
                AND public_number = (
                    commune_code_at_issue
                    || '-'
                    || national_id
                    || check_digit
                )
            )
        );
    END IF;
END
$$;


CREATE UNIQUE INDEX IF NOT EXISTS
    beacons_national_id_unique
ON public.beacons(national_id)
WHERE national_id IS NOT NULL;


CREATE INDEX IF NOT EXISTS
    idx_beacons_commune_code_at_issue
ON public.beacons(commune_code_at_issue)
WHERE commune_code_at_issue IS NOT NULL;


CREATE SEQUENCE IF NOT EXISTS
    public.address_national_id_seq
AS bigint
START WITH 10000000
INCREMENT BY 1
MINVALUE 10000000
MAXVALUE 99999999
NO CYCLE;


DO $$
DECLARE
    v_start bigint;
    v_min bigint;
    v_max bigint;
    v_inc bigint;
    v_cycle boolean;
BEGIN
    SELECT
        start_value,
        min_value,
        max_value,
        increment_by,
        cycle
    INTO
        v_start,
        v_min,
        v_max,
        v_inc,
        v_cycle
    FROM pg_sequences
    WHERE schemaname = 'public'
      AND sequencename = 'address_national_id_seq';

    IF v_start IS DISTINCT FROM 10000000
       OR v_min IS DISTINCT FROM 10000000
       OR v_max IS DISTINCT FROM 99999999
       OR v_inc IS DISTINCT FROM 1
       OR v_cycle IS DISTINCT FROM false
    THEN
        RAISE EXCEPTION
            'Adresse GN V1: configuration séquence invalide.';
    END IF;
END
$$;


COMMENT ON COLUMN public.beacons.national_id IS
'Adresse GN V1: identifiant national à 8 chiffres.';

COMMENT ON COLUMN public.beacons.check_digit IS
'Adresse GN V1: clé de contrôle Verhoeff.';

COMMENT ON COLUMN public.beacons.commune_code_at_issue IS
'Adresse GN V1: code officiel de commune lors de émission.';

COMMENT ON COLUMN public.beacons.numbering_version IS
'Version numérotation Adresse GN: legacy ou v1.';

COMMENT ON SEQUENCE public.address_national_id_seq IS
'Adresse GN V1: allocation nationale 10000000 à 99999999, NO CYCLE.';

COMMIT;
