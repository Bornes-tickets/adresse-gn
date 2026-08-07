-- 1) beacons.qr_token: retirer l'accès colonne pour anon/authenticated
REVOKE SELECT ON public.beacons FROM anon, authenticated;
GRANT SELECT (id, public_number, status, lot_id, created_at, activated_at) ON public.beacons TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.beacons TO authenticated;
GRANT ALL ON public.beacons TO service_role;

-- 2) establishment_photos: lecture publique seulement si adresse publique et active
DROP POLICY IF EXISTS "public read photos" ON public.establishment_photos;
CREATE POLICY "public read photos"
ON public.establishment_photos
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.establishments e
    JOIN public.addresses a ON a.id = e.address_id
    WHERE e.id = establishment_photos.establishment_id
      AND a.visibility = 'public'
      AND a.status = 'active'
  )
);

CREATE POLICY "owner read photos"
ON public.establishment_photos
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.establishments e
    JOIN public.addresses a ON a.id = e.address_id
    WHERE e.id = establishment_photos.establishment_id
      AND (a.owner_id = auth.uid() OR private.current_role_is(ARRAY['admin','supervisor','super_admin']))
  )
);

-- 3) profiles: empêcher l'auto-élévation de rôle
CREATE OR REPLACE FUNCTION private.prevent_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Modification du rôle interdite';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_role_change ON public.profiles;
CREATE TRIGGER profiles_prevent_role_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
WHEN (current_setting('role', true) <> 'service_role')
EXECUTE FUNCTION private.prevent_role_self_escalation();

REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name, phone) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;