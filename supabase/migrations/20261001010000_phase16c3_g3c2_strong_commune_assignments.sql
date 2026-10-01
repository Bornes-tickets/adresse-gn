-- ============================================================================
-- PHASE 16C3 / G3-C2-B1-A1-A3-A3-A2
-- Affectation communale des 11 adresses legacy à preuve STRONG
--
-- IMPORTANT
-- - Aucun numéro Adresse GN V1 n'est créé ici.
-- - Aucun appel à address_national_id_seq.
-- - Aucun district_id n'est modifié.
-- - Aucun beacon legacy n'est converti.
--
-- Chaîne de preuve utilisée :
--   coordonnées GPS Adresse GN
--       -> polygone de quartier OpenStreetMap
--       -> rattachement du quartier au découpage communal actuel
--       -> code communal canonique Adresse GN
--
-- OSM sert uniquement à localiser le point au niveau quartier.
-- OSM n'est PAS traité comme source administrative officielle.
--
-- Affectations validées :
--
-- GN-CKY-759482 -> Dabondy 2       -> CKY02 GBÉSSIA
--
-- GN-CKY-908178 -> Kaporo Centre   -> CKY10 RATOMA
-- GN-CKY-908179 -> Kipé            -> CKY10 RATOMA
-- GN-CKY-908182 -> Kipé            -> CKY10 RATOMA
--
-- GN-CKY-908180 -> Sonfonia Gare 2 -> CKY12 SONFONIA
-- GN-CKY-908181 -> Sonfonia Gare 2 -> CKY12 SONFONIA
-- GN-CKY-908183 -> Sonfonia Gare 2 -> CKY12 SONFONIA
-- GN-CKY-908184 -> Sonfonia Gare 2 -> CKY12 SONFONIA
-- GN-CKY-908185 -> Sonfonia Gare 2 -> CKY12 SONFONIA
-- GN-CKY-908186 -> Sonfonia Gare 2 -> CKY12 SONFONIA
-- GN-CKY-908187 -> Sonfonia Gare 2 -> CKY12 SONFONIA
--
-- Cas NON traités volontairement :
-- GN-CKY-152963 -> REVIEW
-- GN-CKY-334211 -> REVIEW
-- GN-CKY-582741 -> SUPPORTED
-- GN-CKY-908177 -> SUPPORTED
-- ============================================================================

BEGIN;


-- --------------------------------------------------------------------------
-- 1. Garde-fou : les trois communes canoniques doivent exister et être actives.
-- --------------------------------------------------------------------------

DO $$
DECLARE
    v_count integer;
BEGIN

    SELECT COUNT(*)
    INTO v_count

    FROM public.communes

    WHERE
        is_active IS TRUE
        AND code IN (
            'CKY02',
            'CKY10',
            'CKY12'
        );

    IF v_count <> 3 THEN
        RAISE EXCEPTION
            'G3-C2 migration aborted: expected 3 active target communes, found %',
            v_count;
    END IF;

END
$$;


-- --------------------------------------------------------------------------
-- 2. Garde-fou : cohérence code / nom.
--    On compare les codes comme identifiants canoniques.
-- --------------------------------------------------------------------------

DO $$
DECLARE
    v_bad integer;
BEGIN

    SELECT COUNT(*)
    INTO v_bad

    FROM public.communes

    WHERE
        (
            code = 'CKY02'
            AND upper(name) <> upper('GBÉSSIA')
        )
        OR
        (
            code = 'CKY10'
            AND upper(name) <> upper('RATOMA')
        )
        OR
        (
            code = 'CKY12'
            AND upper(name) <> upper('SONFONIA')
        );

    IF v_bad <> 0 THEN
        RAISE EXCEPTION
            'G3-C2 migration aborted: target commune code/name mismatch';
    END IF;

END
$$;


-- --------------------------------------------------------------------------
-- 3. Garde-fou : exactement 11 adresses legacy cibles doivent exister.
-- --------------------------------------------------------------------------

DO $$
DECLARE
    v_count integer;
BEGIN

    SELECT COUNT(*)
    INTO v_count

    FROM public.addresses a

    JOIN public.beacons b
      ON b.id = a.beacon_id

    WHERE
        b.numbering_version = 'legacy'

        AND b.public_number IN (
            'GN-CKY-759482',
            'GN-CKY-908178',
            'GN-CKY-908179',
            'GN-CKY-908180',
            'GN-CKY-908181',
            'GN-CKY-908182',
            'GN-CKY-908183',
            'GN-CKY-908184',
            'GN-CKY-908185',
            'GN-CKY-908186',
            'GN-CKY-908187'
        );

    IF v_count <> 11 THEN
        RAISE EXCEPTION
            'G3-C2 migration aborted: expected 11 target legacy addresses, found %',
            v_count;
    END IF;

END
$$;


-- --------------------------------------------------------------------------
-- 4. Garde-fou : aucune cible ne doit déjà être rattachée à une autre commune.
-- --------------------------------------------------------------------------

DO $$
DECLARE
    v_count integer;
BEGIN

    SELECT COUNT(*)
    INTO v_count

    FROM public.addresses a

    JOIN public.beacons b
      ON b.id = a.beacon_id

    WHERE
        b.public_number IN (
            'GN-CKY-759482',
            'GN-CKY-908178',
            'GN-CKY-908179',
            'GN-CKY-908180',
            'GN-CKY-908181',
            'GN-CKY-908182',
            'GN-CKY-908183',
            'GN-CKY-908184',
            'GN-CKY-908185',
            'GN-CKY-908186',
            'GN-CKY-908187'
        )

        AND a.commune_id IS NOT NULL;

    IF v_count <> 0 THEN
        RAISE EXCEPTION
            'G3-C2 migration aborted: % target addresses already have commune_id',
            v_count;
    END IF;

END
$$;


-- --------------------------------------------------------------------------
-- 5. Garde-fou : district_id reste totalement hors de cette migration.
-- --------------------------------------------------------------------------

DO $$
DECLARE
    v_count integer;
BEGIN

    SELECT COUNT(*)
    INTO v_count

    FROM public.addresses a

    JOIN public.beacons b
      ON b.id = a.beacon_id

    WHERE
        b.public_number IN (
            'GN-CKY-759482',
            'GN-CKY-908178',
            'GN-CKY-908179',
            'GN-CKY-908180',
            'GN-CKY-908181',
            'GN-CKY-908182',
            'GN-CKY-908183',
            'GN-CKY-908184',
            'GN-CKY-908185',
            'GN-CKY-908186',
            'GN-CKY-908187'
        )

        AND a.district_id IS NOT NULL;

    IF v_count <> 0 THEN
        RAISE EXCEPTION
            'G3-C2 migration aborted: % target addresses already have district_id',
            v_count;
    END IF;

END
$$;


-- --------------------------------------------------------------------------
-- 6. GBÉSSIA : 1 adresse.
-- --------------------------------------------------------------------------

UPDATE public.addresses a

SET commune_id = c.id

FROM
    public.beacons b,
    public.communes c

WHERE
    b.id = a.beacon_id

    AND b.numbering_version = 'legacy'

    AND b.public_number = 'GN-CKY-759482'

    AND a.commune_id IS NULL

    AND c.code = 'CKY02'

    AND c.is_active IS TRUE;


-- --------------------------------------------------------------------------
-- 7. RATOMA : 3 adresses.
-- --------------------------------------------------------------------------

UPDATE public.addresses a

SET commune_id = c.id

FROM
    public.beacons b,
    public.communes c

WHERE
    b.id = a.beacon_id

    AND b.numbering_version = 'legacy'

    AND b.public_number IN (
        'GN-CKY-908178',
        'GN-CKY-908179',
        'GN-CKY-908182'
    )

    AND a.commune_id IS NULL

    AND c.code = 'CKY10'

    AND c.is_active IS TRUE;


-- --------------------------------------------------------------------------
-- 8. SONFONIA : 7 adresses.
-- --------------------------------------------------------------------------

UPDATE public.addresses a

SET commune_id = c.id

FROM
    public.beacons b,
    public.communes c

WHERE
    b.id = a.beacon_id

    AND b.numbering_version = 'legacy'

    AND b.public_number IN (
        'GN-CKY-908180',
        'GN-CKY-908181',
        'GN-CKY-908183',
        'GN-CKY-908184',
        'GN-CKY-908185',
        'GN-CKY-908186',
        'GN-CKY-908187'
    )

    AND a.commune_id IS NULL

    AND c.code = 'CKY12'

    AND c.is_active IS TRUE;


-- --------------------------------------------------------------------------
-- 9. Postcondition : exactement 11 cibles doivent maintenant avoir commune_id.
-- --------------------------------------------------------------------------

DO $$
DECLARE
    v_count integer;
BEGIN

    SELECT COUNT(*)
    INTO v_count

    FROM public.addresses a

    JOIN public.beacons b
      ON b.id = a.beacon_id

    WHERE
        b.public_number IN (
            'GN-CKY-759482',
            'GN-CKY-908178',
            'GN-CKY-908179',
            'GN-CKY-908180',
            'GN-CKY-908181',
            'GN-CKY-908182',
            'GN-CKY-908183',
            'GN-CKY-908184',
            'GN-CKY-908185',
            'GN-CKY-908186',
            'GN-CKY-908187'
        )

        AND a.commune_id IS NOT NULL;

    IF v_count <> 11 THEN
        RAISE EXCEPTION
            'G3-C2 migration aborted: expected 11 assignments after update, found %',
            v_count;
    END IF;

END
$$;


-- --------------------------------------------------------------------------
-- 10. Postcondition : distribution exacte attendue.
-- --------------------------------------------------------------------------

DO $$
DECLARE
    v_cky02 integer;
    v_cky10 integer;
    v_cky12 integer;
BEGIN

    SELECT COUNT(*)
    INTO v_cky02

    FROM public.addresses a

    JOIN public.beacons b
      ON b.id = a.beacon_id

    JOIN public.communes c
      ON c.id = a.commune_id

    WHERE
        b.public_number IN (
            'GN-CKY-759482',
            'GN-CKY-908178',
            'GN-CKY-908179',
            'GN-CKY-908180',
            'GN-CKY-908181',
            'GN-CKY-908182',
            'GN-CKY-908183',
            'GN-CKY-908184',
            'GN-CKY-908185',
            'GN-CKY-908186',
            'GN-CKY-908187'
        )

        AND c.code = 'CKY02';


    SELECT COUNT(*)
    INTO v_cky10

    FROM public.addresses a

    JOIN public.beacons b
      ON b.id = a.beacon_id

    JOIN public.communes c
      ON c.id = a.commune_id

    WHERE
        b.public_number IN (
            'GN-CKY-759482',
            'GN-CKY-908178',
            'GN-CKY-908179',
            'GN-CKY-908180',
            'GN-CKY-908181',
            'GN-CKY-908182',
            'GN-CKY-908183',
            'GN-CKY-908184',
            'GN-CKY-908185',
            'GN-CKY-908186',
            'GN-CKY-908187'
        )

        AND c.code = 'CKY10';


    SELECT COUNT(*)
    INTO v_cky12

    FROM public.addresses a

    JOIN public.beacons b
      ON b.id = a.beacon_id

    JOIN public.communes c
      ON c.id = a.commune_id

    WHERE
        b.public_number IN (
            'GN-CKY-759482',
            'GN-CKY-908178',
            'GN-CKY-908179',
            'GN-CKY-908180',
            'GN-CKY-908181',
            'GN-CKY-908182',
            'GN-CKY-908183',
            'GN-CKY-908184',
            'GN-CKY-908185',
            'GN-CKY-908186',
            'GN-CKY-908187'
        )

        AND c.code = 'CKY12';


    IF
        v_cky02 <> 1
        OR v_cky10 <> 3
        OR v_cky12 <> 7
    THEN

        RAISE EXCEPTION
            'G3-C2 migration aborted: invalid distribution CKY02=%, CKY10=%, CKY12=%',
            v_cky02,
            v_cky10,
            v_cky12;

    END IF;

END
$$;


COMMIT;