-- ============================================================================
-- PHASE 16C3 / G3-C2-C7
-- Repositionnement du premier identifiant national Adresse GN V1
--
-- IMPORTANT :
-- - La séquence Adresse GN V1 n'a encore jamais été consommée.
-- - Aucun beacon V1 n'existe.
-- - Aucun national_id n'a encore été attribué.
-- - La plage reste 10000000..99999999.
-- - Seule la prochaine valeur d'émission devient 58274136.
--
-- Premières valeurs attendues :
--   58274136 -> clé Verhoeff 9 -> 582741369
--   58274137 -> clé Verhoeff 6 -> 582741376
--   58274138 -> clé Verhoeff 2 -> 582741382
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_last bigint;
    v_called boolean;
    v_v1_count bigint;
    v_national_id_count bigint;
BEGIN

    SELECT
        last_value,
        is_called
    INTO
        v_last,
        v_called
    FROM public.address_national_id_seq;

    IF
        v_last IS DISTINCT FROM 10000000
        OR v_called IS DISTINCT FROM FALSE
    THEN
        RAISE EXCEPTION
            'Adresse GN sequence reposition aborted: expected (10000000,false), found (%,%)',
            v_last,
            v_called;
    END IF;


    SELECT COUNT(*)
    INTO v_v1_count
    FROM public.beacons
    WHERE numbering_version = 'v1';

    IF v_v1_count <> 0 THEN
        RAISE EXCEPTION
            'Adresse GN sequence reposition aborted: % V1 beacons already exist',
            v_v1_count;
    END IF;


    SELECT COUNT(*)
    INTO v_national_id_count
    FROM public.beacons
    WHERE national_id IS NOT NULL;

    IF v_national_id_count <> 0 THEN
        RAISE EXCEPTION
            'Adresse GN sequence reposition aborted: % national IDs already allocated',
            v_national_id_count;
    END IF;


    IF EXISTS (
        SELECT 1
        FROM public.beacons
        WHERE national_id IN (
            '58274136',
            '58274137',
            '58274138'
        )
    ) THEN
        RAISE EXCEPTION
            'Adresse GN sequence reposition aborted: proposed initial IDs already exist';
    END IF;

END
$$;


ALTER SEQUENCE public.address_national_id_seq
    RESTART WITH 58274136;


COMMENT ON SEQUENCE public.address_national_id_seq IS
    'Adresse GN V1: allocation nationale 10000000 à 99999999, NO CYCLE; première émission de production configurée à 58274136 avant toute consommation.';


DO $$
DECLARE
    v_last bigint;
    v_called boolean;
BEGIN

    SELECT
        last_value,
        is_called
    INTO
        v_last,
        v_called
    FROM public.address_national_id_seq;

    IF
        v_last IS DISTINCT FROM 58274136
        OR v_called IS DISTINCT FROM FALSE
    THEN
        RAISE EXCEPTION
            'Adresse GN sequence reposition failed: expected (58274136,false), found (%,%)',
            v_last,
            v_called;
    END IF;

END
$$;

COMMIT;