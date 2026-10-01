-- ============================================================================
-- PHASE 16C3 / G3-C2-C11-B
-- Affectation communale qualifiée : Pharmacie Ratoma -> CKY10 RATOMA
--
-- Preconditions fonctionnelles :
-- - adresse legacy ;
-- - catégorie pharmacie ;
-- - visibilité publique ;
-- - niveau verified ;
-- - commune actuelle NULL ;
-- - district actuel NULL ;
-- - commune canonique cible active : CKY10 RATOMA.
--
-- IMPORTANT :
-- - Aucun changement de public_number.
-- - Aucun changement de numbering_version.
-- - Aucun national_id attribué.
-- - Aucun district inventé.
-- - Aucun appel à address_national_id_seq.
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
        code = 'CKY10'
        AND upper(name) = 'RATOMA'
        AND is_active = TRUE
    LIMIT 1;

    IF v_commune_id IS NULL THEN
        RAISE EXCEPTION
            'Pharmacie Ratoma migration aborted: active CKY10 RATOMA not found';
    END IF;


    SELECT COUNT(*)
    INTO v_count
    FROM public.addresses a
    JOIN public.beacons b
      ON b.id = a.beacon_id
    WHERE
        b.public_number = 'GN-CKY-334211'
        AND b.numbering_version = 'legacy'
        AND a.name = 'Pharmacie Ratoma'
        AND a.category = 'pharmacie'
        AND a.visibility = 'public'
        AND a.verification_level = 'verified'
        AND a.commune_id IS NULL
        AND a.district_id IS NULL;

    IF v_count <> 1 THEN
        RAISE EXCEPTION
            'Pharmacie Ratoma migration aborted: expected exactly 1 eligible address, found %',
            v_count;
    END IF;


    UPDATE public.addresses a
    SET
        commune_id = v_commune_id,
        updated_at = now()
    FROM public.beacons b
    WHERE
        b.id = a.beacon_id
        AND b.public_number = 'GN-CKY-334211'
        AND b.numbering_version = 'legacy'
        AND a.name = 'Pharmacie Ratoma'
        AND a.category = 'pharmacie'
        AND a.visibility = 'public'
        AND a.verification_level = 'verified'
        AND a.commune_id IS NULL
        AND a.district_id IS NULL;


    GET DIAGNOSTICS v_count = ROW_COUNT;

    IF v_count <> 1 THEN
        RAISE EXCEPTION
            'Pharmacie Ratoma migration aborted: expected 1 update, got %',
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
            b.public_number = 'GN-CKY-334211'
            AND c.code = 'CKY10'
            AND upper(c.name) = 'RATOMA'
            AND a.district_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'Pharmacie Ratoma migration verification failed';
    END IF;

END
$$;

COMMIT;