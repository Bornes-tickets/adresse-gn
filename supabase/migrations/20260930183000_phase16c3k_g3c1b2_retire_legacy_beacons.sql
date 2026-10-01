BEGIN;

-- =====================================================================
-- Adresse GN — G3-C1-B2
-- Retrait métier des anciennes balises legacy.
--
-- Règles :
--   - legacy liée à une activité métier => suspended
--   - legacy sans relation métier      => cancelled
--
-- Aucun DELETE.
-- Aucun changement de public_number / qr_token.
-- Aucune consommation de la séquence V1.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Legacy avec historique / utilisation :
--    suspension en attente du remplacement physique V1.
-- ---------------------------------------------------------------------

UPDATE public.beacons AS b
SET status = 'suspended'
WHERE b.numbering_version = 'legacy'
  AND b.status IN (
      'generated',
      'assigned',
      'installed',
      'active'
  )
  AND (
      EXISTS (
          SELECT 1
          FROM public.addresses AS a
          WHERE a.beacon_id = b.id
      )
      OR EXISTS (
          SELECT 1
          FROM public.installations AS i
          WHERE i.beacon_id = b.id
      )
      OR EXISTS (
          SELECT 1
          FROM public.claim_requests AS c
          WHERE c.beacon_id = b.id
      )
      OR EXISTS (
          SELECT 1
          FROM public.unclaimed_owners AS u
          WHERE u.beacon_id = b.id
      )
  );


-- ---------------------------------------------------------------------
-- 2. Legacy inutilisées :
--    annulation définitive de leur utilisation opérationnelle.
-- ---------------------------------------------------------------------

UPDATE public.beacons AS b
SET status = 'cancelled'
WHERE b.numbering_version = 'legacy'
  AND b.status IN (
      'generated',
      'assigned',
      'installed',
      'active'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM public.addresses AS a
      WHERE a.beacon_id = b.id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM public.installations AS i
      WHERE i.beacon_id = b.id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM public.claim_requests AS c
      WHERE c.beacon_id = b.id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM public.unclaimed_owners AS u
      WHERE u.beacon_id = b.id
  );


COMMIT;