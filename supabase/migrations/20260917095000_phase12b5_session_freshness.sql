-- ============================================================
-- Phase 12B.5
-- Fresh session enforcement after account reactivation.
--
-- Objectif :
--   un token / une session créé avant la dernière réactivation
--   ne redevient jamais valable quand account_status repasse à active.
--
-- Supabase Auth reste la source d'identité.
-- Aucun auth.users n'est modifié.
-- Les données métier ne sont pas modifiées.
-- ============================================================

ALTER TABLE public.profiles
    ADD COLUMN session_valid_after timestamptz NULL;

COMMENT ON COLUMN public.profiles.session_valid_after IS
    'Après réactivation, seules les sessions Supabase créées après cette date sont valides. NULL = aucune coupure historique.';

UPDATE public.profiles p
SET session_valid_after = latest.reactivated_at
FROM (
    SELECT
        entity_id::text AS profile_id,
        MAX(created_at) AS reactivated_at
    FROM public.audit_logs
    WHERE
        action = 'account_reactivated'
        AND entity = 'profile'
    GROUP BY entity_id::text
) latest
WHERE
    p.id::text = latest.profile_id
    AND p.account_status = 'active';

CREATE OR REPLACE FUNCTION private.current_account_is_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE
            p.id = auth.uid()
            AND p.account_status = 'active'
            AND (
                p.session_valid_after IS NULL
                OR EXISTS (
                    SELECT 1
                    FROM auth.sessions s
                    WHERE
                        s.user_id = p.id
                        AND s.id::text = COALESCE(
                            auth.jwt() ->> 'session_id',
                            ''
                        )
                        AND s.created_at > p.session_valid_after
                )
            )
    );
$function$;

REVOKE ALL
ON FUNCTION private.current_account_is_active()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION private.current_account_is_active()
FROM anon;

GRANT EXECUTE
ON FUNCTION private.current_account_is_active()
TO authenticated;

GRANT EXECUTE
ON FUNCTION private.current_account_is_active()
TO service_role;

CREATE OR REPLACE FUNCTION private.current_role_is(
    target_roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE
            p.id = auth.uid()
            AND p.role = ANY(target_roles)
            AND private.current_account_is_active()
    );
$function$;

REVOKE ALL
ON FUNCTION private.current_role_is(text[])
FROM PUBLIC;

REVOKE ALL
ON FUNCTION private.current_role_is(text[])
FROM anon;

GRANT EXECUTE
ON FUNCTION private.current_role_is(text[])
TO authenticated;

GRANT EXECUTE
ON FUNCTION private.current_role_is(text[])
TO service_role;

DO $phase12b5_postconditions$
DECLARE
    v_column_count integer;
    v_current_account_definition text;
    v_current_role_definition text;
BEGIN
    SELECT COUNT(*)
    INTO v_column_count
    FROM information_schema.columns
    WHERE
        table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'session_valid_after'
        AND data_type = 'timestamp with time zone';

    IF v_column_count <> 1 THEN
        RAISE EXCEPTION
            'Phase12B.5: colonne session_valid_after absente ou invalide';
    END IF;

    SELECT pg_get_functiondef(p.oid)
    INTO v_current_account_definition
    FROM pg_proc p
    JOIN pg_namespace n
        ON n.oid = p.pronamespace
    WHERE
        n.nspname = 'private'
        AND p.proname = 'current_account_is_active'
        AND pg_get_function_identity_arguments(p.oid) = ''
    LIMIT 1;

    IF (
        v_current_account_definition IS NULL
        OR POSITION(
            'session_valid_after'
            IN v_current_account_definition
        ) = 0
        OR POSITION(
            'auth.sessions'
            IN v_current_account_definition
        ) = 0
    ) THEN
        RAISE EXCEPTION
            'Phase12B.5: current_account_is_active non durci';
    END IF;

    SELECT pg_get_functiondef(p.oid)
    INTO v_current_role_definition
    FROM pg_proc p
    JOIN pg_namespace n
        ON n.oid = p.pronamespace
    WHERE
        n.nspname = 'private'
        AND p.proname = 'current_role_is'
        AND pg_get_function_identity_arguments(p.oid) = 'target_roles text[]'
    LIMIT 1;

    IF (
        v_current_role_definition IS NULL
        OR POSITION(
            'current_account_is_active'
            IN v_current_role_definition
        ) = 0
    ) THEN
        RAISE EXCEPTION
            'Phase12B.5: current_role_is non relié au guard de session';
    END IF;
END
$phase12b5_postconditions$;
