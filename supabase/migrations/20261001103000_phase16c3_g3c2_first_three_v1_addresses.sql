-- ============================================================================
-- PHASE 16C3 / G3-C2-C12-D2
-- Première émission contrôlée de trois numéros Adresse GN V1.
--
-- Public 1 : Hôtel Kaloum Palace
--   legacy : GN-CKY-152963
--   V1     : CKY04-582741369
--
-- Public 2 : Pharmacie Ratoma
--   legacy : GN-CKY-334211
--   V1     : CKY10-582741376
--
-- Privé :
--   legacy : GN-CKY-759482
--   V1     : CKY02-582741382
--
-- Principes :
-- - aucun nextval();
-- - conservation des beacons legacy ;
-- - conservation des UUID des adresses ;
-- - traçabilité legacy -> V1 via beacon_replacements ;
-- - les historiques legacy restent liés aux anciens beacons ;
-- - prochain identifiant productif après migration : 58274139.
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_sequence_last bigint;
    v_sequence_called boolean;

    v_legacy_hotel uuid;
    v_legacy_pharmacy uuid;
    v_legacy_private uuid;

    v_address_hotel uuid;
    v_address_pharmacy uuid;
    v_address_private uuid;

    v_v1_hotel uuid;
    v_v1_pharmacy uuid;
    v_v1_private uuid;

    v_count bigint;
BEGIN

    -- ========================================================================
    -- 1. GARDE DE SÉQUENCE
    -- ========================================================================

    SELECT
        last_value,
        is_called
    INTO
        v_sequence_last,
        v_sequence_called
    FROM public.address_national_id_seq;

    IF v_sequence_last <> 58274136
       OR v_sequence_called <> FALSE THEN
        RAISE EXCEPTION
            'V1 migration aborted: unexpected sequence state (%, %)',
            v_sequence_last,
            v_sequence_called;
    END IF;


    -- ========================================================================
    -- 2. AUCUN V1 / NATIONAL ID EXISTANT
    -- ========================================================================

    SELECT COUNT(*)
    INTO v_count
    FROM public.beacons
    WHERE
        numbering_version = 'v1'
        OR national_id IS NOT NULL;

    IF v_count <> 0 THEN
        RAISE EXCEPTION
            'V1 migration aborted: existing V1/national IDs found: %',
            v_count;
    END IF;


    -- ========================================================================
    -- 3. TABLE DE TRAÇABILITÉ VIDE
    -- ========================================================================

    SELECT COUNT(*)
    INTO v_count
    FROM public.beacon_replacements;

    IF v_count <> 0 THEN
        RAISE EXCEPTION
            'V1 migration aborted: beacon_replacements not empty: %',
            v_count;
    END IF;


    -- ========================================================================
    -- 4. CONTRÔLE DES TROIS BEACONS LEGACY
    -- ========================================================================

    SELECT id
    INTO v_legacy_hotel
    FROM public.beacons
    WHERE
        public_number = 'GN-CKY-152963'
        AND numbering_version = 'legacy'
        AND status = 'suspended';

    IF v_legacy_hotel IS NULL THEN
        RAISE EXCEPTION
            'V1 migration aborted: Hôtel Kaloum legacy beacon invalid';
    END IF;


    SELECT id
    INTO v_legacy_pharmacy
    FROM public.beacons
    WHERE
        public_number = 'GN-CKY-334211'
        AND numbering_version = 'legacy'
        AND status = 'suspended';

    IF v_legacy_pharmacy IS NULL THEN
        RAISE EXCEPTION
            'V1 migration aborted: Pharmacie Ratoma legacy beacon invalid';
    END IF;


    SELECT id
    INTO v_legacy_private
    FROM public.beacons
    WHERE
        public_number = 'GN-CKY-759482'
        AND numbering_version = 'legacy'
        AND status = 'suspended';

    IF v_legacy_private IS NULL THEN
        RAISE EXCEPTION
            'V1 migration aborted: private legacy beacon invalid';
    END IF;


    -- ========================================================================
    -- 5. CONTRÔLE DES TROIS ADRESSES
    -- ========================================================================

    SELECT a.id
    INTO v_address_hotel
    FROM public.addresses a
    JOIN public.communes c
      ON c.id = a.commune_id
    WHERE
        a.beacon_id = v_legacy_hotel
        AND a.name = 'Hôtel Kaloum Palace'
        AND a.category = 'hotel'
        AND a.visibility = 'public'
        AND a.verification_level = 'verified'
        AND a.status = 'active'
        AND c.code = 'CKY04'
        AND a.district_id IS NULL;

    IF v_address_hotel IS NULL THEN
        RAISE EXCEPTION
            'V1 migration aborted: Hôtel Kaloum address invalid';
    END IF;


    SELECT a.id
    INTO v_address_pharmacy
    FROM public.addresses a
    JOIN public.communes c
      ON c.id = a.commune_id
    WHERE
        a.beacon_id = v_legacy_pharmacy
        AND a.name = 'Pharmacie Ratoma'
        AND a.category = 'pharmacie'
        AND a.visibility = 'public'
        AND a.verification_level = 'verified'
        AND a.status = 'active'
        AND c.code = 'CKY10'
        AND a.district_id IS NULL;

    IF v_address_pharmacy IS NULL THEN
        RAISE EXCEPTION
            'V1 migration aborted: Pharmacie Ratoma address invalid';
    END IF;


    SELECT a.id
    INTO v_address_private
    FROM public.addresses a
    JOIN public.communes c
      ON c.id = a.commune_id
    WHERE
        a.beacon_id = v_legacy_private
        AND a.name = 'Habitation privée'
        AND a.category = 'habitation'
        AND a.visibility = 'private'
        AND a.verification_level = 'verified'
        AND a.status = 'active'
        AND c.code = 'CKY02'
        AND a.district_id IS NULL;

    IF v_address_private IS NULL THEN
        RAISE EXCEPTION
            'V1 migration aborted: private address invalid';
    END IF;


    -- ========================================================================
    -- 6. AUCUN CONFLIT SUR LES TROIS NOUVEAUX IDENTIFIANTS
    -- ========================================================================

    SELECT COUNT(*)
    INTO v_count
    FROM public.beacons
    WHERE
        public_number IN (
            'CKY04-582741369',
            'CKY10-582741376',
            'CKY02-582741382'
        )
        OR national_id IN (
            '58274136',
            '58274137',
            '58274138'
        );

    IF v_count <> 0 THEN
        RAISE EXCEPTION
            'V1 migration aborted: V1 identifier conflict: %',
            v_count;
    END IF;


    -- ========================================================================
    -- 7. CRÉATION DES TROIS BEACONS V1
    -- ========================================================================

    INSERT INTO public.beacons (
        public_number,
        status,
        category,
        lot_id,
        activated_at,
        national_id,
        check_digit,
        commune_code_at_issue,
        numbering_version
    )
    VALUES (
        'CKY04-582741369',
        'active',
        'digital_only',
        NULL,
        NOW(),
        '58274136',
        '9',
        'CKY04',
        'v1'
    )
    RETURNING id
    INTO v_v1_hotel;


    INSERT INTO public.beacons (
        public_number,
        status,
        category,
        lot_id,
        activated_at,
        national_id,
        check_digit,
        commune_code_at_issue,
        numbering_version
    )
    VALUES (
        'CKY10-582741376',
        'active',
        'digital_only',
        NULL,
        NOW(),
        '58274137',
        '6',
        'CKY10',
        'v1'
    )
    RETURNING id
    INTO v_v1_pharmacy;


    INSERT INTO public.beacons (
        public_number,
        status,
        category,
        lot_id,
        activated_at,
        national_id,
        check_digit,
        commune_code_at_issue,
        numbering_version
    )
    VALUES (
        'CKY02-582741382',
        'active',
        'digital_only',
        NULL,
        NOW(),
        '58274138',
        '2',
        'CKY02',
        'v1'
    )
    RETURNING id
    INTO v_v1_private;


    -- ========================================================================
    -- 8. TRAÇABILITÉ LEGACY -> V1
    -- ========================================================================

    INSERT INTO public.beacon_replacements (
        legacy_beacon_id,
        v1_beacon_id,
        reason
    )
    VALUES
        (
            v_legacy_hotel,
            v_v1_hotel,
            'legacy_v1_migration'
        ),
        (
            v_legacy_pharmacy,
            v_v1_pharmacy,
            'legacy_v1_migration'
        ),
        (
            v_legacy_private,
            v_v1_private,
            'legacy_v1_migration'
        );


    -- ========================================================================
    -- 9. BASCULE DES TROIS ADRESSES EXISTANTES VERS LES BEACONS V1
    -- ========================================================================

    UPDATE public.addresses
    SET
        beacon_id = v_v1_hotel,
        updated_at = NOW()
    WHERE
        id = v_address_hotel
        AND beacon_id = v_legacy_hotel;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    IF v_count <> 1 THEN
        RAISE EXCEPTION
            'V1 migration aborted: Hôtel Kaloum address switch failed';
    END IF;


    UPDATE public.addresses
    SET
        beacon_id = v_v1_pharmacy,
        updated_at = NOW()
    WHERE
        id = v_address_pharmacy
        AND beacon_id = v_legacy_pharmacy;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    IF v_count <> 1 THEN
        RAISE EXCEPTION
            'V1 migration aborted: Pharmacie Ratoma address switch failed';
    END IF;


    UPDATE public.addresses
    SET
        beacon_id = v_v1_private,
        updated_at = NOW()
    WHERE
        id = v_address_private
        AND beacon_id = v_legacy_private;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    IF v_count <> 1 THEN
        RAISE EXCEPTION
            'V1 migration aborted: private address switch failed';
    END IF;


    -- ========================================================================
    -- 10. LES ANCIENS BEACONS DEVIENNENT "REPLACED"
    -- ========================================================================

    UPDATE public.beacons
    SET status = 'replaced'
    WHERE id IN (
        v_legacy_hotel,
        v_legacy_pharmacy,
        v_legacy_private
    )
    AND status = 'suspended'
    AND numbering_version = 'legacy';

    GET DIAGNOSTICS v_count = ROW_COUNT;

    IF v_count <> 3 THEN
        RAISE EXCEPTION
            'V1 migration aborted: expected 3 legacy replacements, got %',
            v_count;
    END IF;


    -- ========================================================================
    -- 11. POST-CONTRÔLES
    -- ========================================================================

    SELECT COUNT(*)
    INTO v_count
    FROM public.beacons
    WHERE
        numbering_version = 'v1'
        AND public_number IN (
            'CKY04-582741369',
            'CKY10-582741376',
            'CKY02-582741382'
        );

    IF v_count <> 3 THEN
        RAISE EXCEPTION
            'V1 migration verification failed: V1 beacon count %',
            v_count;
    END IF;


    SELECT COUNT(*)
    INTO v_count
    FROM public.beacon_replacements
    WHERE legacy_beacon_id IN (
        v_legacy_hotel,
        v_legacy_pharmacy,
        v_legacy_private
    );

    IF v_count <> 3 THEN
        RAISE EXCEPTION
            'V1 migration verification failed: replacement count %',
            v_count;
    END IF;


    SELECT COUNT(*)
    INTO v_count
    FROM public.addresses
    WHERE
        (id = v_address_hotel AND beacon_id = v_v1_hotel)
        OR
        (id = v_address_pharmacy AND beacon_id = v_v1_pharmacy)
        OR
        (id = v_address_private AND beacon_id = v_v1_private);

    IF v_count <> 3 THEN
        RAISE EXCEPTION
            'V1 migration verification failed: address switch count %',
            v_count;
    END IF;

END
$$;


-- ============================================================================
-- 12. POSITIONNER LE PROCHAIN IDENTIFIANT PRODUCTIF
--
-- Aucun nextval() n'a été utilisé.
-- ALTER SEQUENCE RESTART est transactionnel.
-- Après COMMIT :
--   last_value = 58274139
--   is_called  = false
--   prochain nextval() = 58274139
-- ============================================================================

ALTER SEQUENCE public.address_national_id_seq
RESTART WITH 58274139;


COMMIT;