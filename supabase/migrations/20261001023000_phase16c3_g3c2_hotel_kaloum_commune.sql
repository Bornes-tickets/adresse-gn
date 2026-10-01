-- ============================================================================
-- PHASE 16C3 / G3-C2-C10-A
-- Affectation communale qualifiée : Hôtel Kaloum Palace -> CKY04 KALOUM
--
-- Justification :
-- - adresse legacy publique et vérifiée ;
-- - point GPS existant ;
-- - établissement actuel confirmé à Almamya ;
-- - établissement lui-même indique "commune de Kaloum" ;
-- - code canonique actif attendu : CKY04.
--
-- IMPORTANT :
-- - Aucun changement de public_number.
-- - Aucun changement de numbering_version.
-- - Aucun appel à address_national_id_seq.
-- - Aucun district inventé.
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_commune_id uuid;
    v_count bigint;
BEGIN

    SELECT id
    INTO v_commune_id
    FROM public.communes
    WHERE
        code = 'CKY04'
        AND upper(name) = 'KALOUM'
        AND is_active = TRUE
    LIMIT 1;

    IF v_commune_id IS NULL THEN
        RAISE EXCEPTION
            'Hotel Kaloum migration aborted: active CKY04 KALOUM not found';
    END IF;


    SELECT COUNT(*)
    INTO v_count
    FROM public.addresses a
    JOIN public.beacons b
      ON b.id = a.beacon_id
    WHERE
        b.public_number = 'GN-CKY-152963'
        AND b.numbering_version = 'legacy'
        AND a.name = 'Hôtel Kaloum Palace'
        AND a.category = 'hotel'
        AND a.visibility = 'public'
        AND a.verification_level = 'verified'
        AND a.commune_id IS NULL
        AND a.district_id IS NULL;

    IF v_count <> 1 THEN
        RAISE EXCEPTION
            'Hotel Kaloum migration aborted: expected exactly 1 eligible address, found %',
            v_count;
    END IF;


    UPDATE public.addresses a
    SET
        commune_id = v_commune_id,
        updated_at = now()
    FROM public.beacons b
    WHERE
        b.id = a.beacon_id
        AND b.public_number = 'GN-CKY-152963'
        AND b.numbering_version = 'legacy'
        AND a.name = 'Hôtel Kaloum Palace'
        AND a.category = 'hotel'
        AND a.visibility = 'public'
        AND a.verification_level = 'verified'
        AND a.commune_id IS NULL
        AND a.district_id IS NULL;


    GET DIAGNOSTICS v_count = ROW_COUNT;

    IF v_count <> 1 THEN
        RAISE EXCEPTION
            'Hotel Kaloum migration aborted: expected 1 update, got %',
            v_count;
    END IF;


    IF NOT EXISTS (
        SELECT 1
        FROM public.addresses a
        JOIN public.beacons b
          ON b.id = a.beacon_id
        JOIN public.communes c
          ON c.id = a.commune_id
        WHERE
            b.public_number = 'GN-CKY-152963'
            AND c.code = 'CKY04'
            AND upper(c.name) = 'KALOUM'
            AND a.district_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'Hotel Kaloum migration verification failed';
    END IF;

END
$$;

COMMIT;