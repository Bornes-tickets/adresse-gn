-- Phase 12B.1
-- Cycle de vie du compte Adresse GN.
--
-- Cette migration ne désactive aucun compte existant.
-- Tous les profils actuels deviennent explicitement "active".

ALTER TABLE public.profiles
    ADD COLUMN account_status text NOT NULL DEFAULT 'active';

ALTER TABLE public.profiles
    ADD COLUMN deactivated_at timestamptz NULL;


ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_account_lifecycle_check
    CHECK (
        (
            account_status = 'active'
            AND deactivated_at IS NULL
        )
        OR
        (
            account_status = 'deactivated'
            AND deactivated_at IS NOT NULL
        )
    );


CREATE OR REPLACE FUNCTION private.current_account_is_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE
            p.id = auth.uid()
            AND p.account_status = 'active'
    );
$$;


REVOKE ALL
ON FUNCTION private.current_account_is_active()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION private.current_account_is_active()
TO authenticated;