-- ============================================================
-- Phase 12B.2C
-- Enforcement lifecycle au niveau RLS
--
-- Objectifs :
--   1. current_role_is() refuse un profil non actif ;
--   2. current_role_is() utilise search_path vide ;
--   3. les policies privées historiques TO public passent
--      explicitement TO authenticated ;
--   4. toutes les branches directes auth.uid() exigent
--      current_account_is_active() ;
--   5. geo_reference_gaps exige un compte actif ;
--   6. les lectures réellement publiques restent inchangées.
--
-- Aucun changement de donnée métier.
-- Aucun changement d'adresse publique.
-- Aucun changement Supabase Auth.
-- Aucun changement du trigger profiles.
-- ============================================================


-- ------------------------------------------------------------
-- Préconditions strictes : refuser d'appliquer sur un schéma
-- différent de celui audité.
-- ------------------------------------------------------------

DO $phase12b2c_preconditions$
DECLARE
    v_total_policies integer;
    v_uid_policies integer;
    v_role_only_policies integer;
    v_private_public_policies integer;
    v_geo_admin_policies integer;
    v_geo_gap_policies integer;
    v_public_address_policies integer;
    v_current_role_definition text;
    v_current_role_config text[];
BEGIN

    SELECT COUNT(*)
    INTO v_total_policies
    FROM pg_policies
    WHERE schemaname = 'public';

    IF v_total_policies <> 102 THEN
        RAISE EXCEPTION
            'Phase12B.2C: nombre total de policies inattendu: %',
            v_total_policies;
    END IF;


    -- DIRECT_UID + MIXED_UID_ROLE.
    SELECT COUNT(*)
    INTO v_uid_policies
    FROM pg_policies
    WHERE
        schemaname = 'public'
        AND POSITION(
            'auth.uid()'
            IN (
                COALESCE(qual, '')
                || ' '
                || COALESCE(with_check, '')
            )
        ) > 0;

    IF v_uid_policies <> 46 THEN
        RAISE EXCEPTION
            'Phase12B.2C: nombre policies auth.uid inattendu: %',
            v_uid_policies;
    END IF;


    -- ROLE_HELPER uniquement : current_role_is sans auth.uid.
    SELECT COUNT(*)
    INTO v_role_only_policies
    FROM pg_policies
    WHERE
        schemaname = 'public'
        AND POSITION(
            'private.current_role_is'
            IN (
                COALESCE(qual, '')
                || ' '
                || COALESCE(with_check, '')
            )
        ) > 0
        AND POSITION(
            'auth.uid()'
            IN (
                COALESCE(qual, '')
                || ' '
                || COALESCE(with_check, '')
            )
        ) = 0;

    IF v_role_only_policies <> 36 THEN
        RAISE EXCEPTION
            'Phase12B.2C: nombre ROLE_HELPER inattendu: %',
            v_role_only_policies;
    END IF;


    -- Toutes les policies privées historiques TO public.
    SELECT COUNT(*)
    INTO v_private_public_policies
    FROM pg_policies
    WHERE
        schemaname = 'public'
        AND 'public'::name = ANY(roles)
        AND (
            POSITION(
                'auth.uid()'
                IN (
                    COALESCE(qual, '')
                    || ' '
                    || COALESCE(with_check, '')
                )
            ) > 0
            OR
            POSITION(
                'private.current_role_is'
                IN (
                    COALESCE(qual, '')
                    || ' '
                    || COALESCE(with_check, '')
                )
            ) > 0
        );

    IF v_private_public_policies <> 40 THEN
        RAISE EXCEPTION
            'Phase12B.2C: nombre policies privées TO public inattendu: %',
            v_private_public_policies;
    END IF;


    SELECT COUNT(*)
    INTO v_geo_admin_policies
    FROM pg_policies
    WHERE
        schemaname = 'public'
        AND policyname IN (
            'geo admins write prefectures',
            'geo admins write sectors'
        )
        AND POSITION(
            'geo_is_admin()'
            IN (
                COALESCE(qual, '')
                || ' '
                || COALESCE(with_check, '')
            )
        ) > 0;

    IF v_geo_admin_policies <> 2 THEN
        RAISE EXCEPTION
            'Phase12B.2C: policies geo admin inattendues: %',
            v_geo_admin_policies;
    END IF;


    SELECT COUNT(*)
    INTO v_geo_gap_policies
    FROM pg_policies
    WHERE
        schemaname = 'public'
        AND tablename = 'geo_reference_gaps'
        AND policyname = 'geo authenticated read gaps'
        AND cmd = 'SELECT'
        AND 'authenticated'::name = ANY(roles);

    IF v_geo_gap_policies <> 1 THEN
        RAISE EXCEPTION
            'Phase12B.2C: policy geo gaps inattendue';
    END IF;


    -- La lecture publique Adresse GN est un invariant métier.
    SELECT COUNT(*)
    INTO v_public_address_policies
    FROM pg_policies
    WHERE
        schemaname = 'public'
        AND tablename = 'addresses'
        AND policyname = 'public read addresses'
        AND cmd = 'SELECT'
        AND 'public'::name = ANY(roles)
        AND POSITION(
            'visibility'
            IN COALESCE(qual, '')
        ) > 0
        AND POSITION(
            '''public'''
            IN COALESCE(qual, '')
        ) > 0
        AND POSITION(
            'status'
            IN COALESCE(qual, '')
        ) > 0
        AND POSITION(
            '''active'''
            IN COALESCE(qual, '')
        ) > 0
        AND POSITION(
            'auth.uid()'
            IN COALESCE(qual, '')
        ) = 0
        AND POSITION(
            'current_account_is_active'
            IN COALESCE(qual, '')
        ) = 0;

    IF v_public_address_policies <> 1 THEN
        RAISE EXCEPTION
            'Phase12B.2C: policy public read addresses inattendue';
    END IF;


    SELECT
        pg_get_functiondef(p.oid),
        p.proconfig
    INTO
        v_current_role_definition,
        v_current_role_config
    FROM pg_proc p
    JOIN pg_namespace n
        ON n.oid = p.pronamespace
    WHERE
        n.nspname = 'private'
        AND p.proname = 'current_role_is'
        AND pg_get_function_identity_arguments(
            p.oid
        ) = 'target_roles text[]'
    LIMIT 1;


    IF v_current_role_definition IS NULL THEN
        RAISE EXCEPTION
            'Phase12B.2C: current_role_is introuvable';
    END IF;


    IF POSITION(
        'account_status'
        IN v_current_role_definition
    ) > 0 THEN
        RAISE EXCEPTION
            'Phase12B.2C: current_role_is semble déjà lifecycle-aware';
    END IF;


    IF NOT (
        v_current_role_config
        @> ARRAY['search_path=public']::text[]
    ) THEN
        RAISE EXCEPTION
            'Phase12B.2C: search_path current_role_is inattendu';
    END IF;

END
$phase12b2c_preconditions$;


-- ------------------------------------------------------------
-- 1. Durcir current_role_is()
--
-- Le rôle métier ne vaut plus rien si le compte est désactivé.
-- Toutes les références sont qualifiées : search_path vide.
-- ------------------------------------------------------------

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
            AND p.account_status = 'active'
            AND p.role = ANY(target_roles)
    );
$function$;


-- Le helper n'est plus directement exécutable par anon.
REVOKE ALL
ON FUNCTION private.current_role_is(text[])
FROM PUBLIC;

REVOKE ALL
ON FUNCTION private.current_role_is(text[])
FROM anon;

GRANT EXECUTE
ON FUNCTION private.current_role_is(text[])
TO authenticated;

-- Préserver explicitement le comportement historique service_role.
GRANT EXECUTE
ON FUNCTION private.current_role_is(text[])
TO service_role;


-- ------------------------------------------------------------
-- 2. Normaliser les policies privées TO public
--    vers TO authenticated.
--
-- Ces policies utilisaient auth.uid/current_role_is et ne
-- produisaient jamais d'accès utile pour anon.
-- Les vraies policies publiques ne sont pas concernées.
-- ------------------------------------------------------------

DO $phase12b2c_normalize_roles$
DECLARE
    r record;
    v_count integer := 0;
BEGIN

    FOR r IN
        SELECT
            tablename,
            policyname
        FROM pg_policies
        WHERE
            schemaname = 'public'
            AND 'public'::name = ANY(roles)
            AND (
                POSITION(
                    'auth.uid()'
                    IN (
                        COALESCE(qual, '')
                        || ' '
                        || COALESCE(with_check, '')
                    )
                ) > 0
                OR
                POSITION(
                    'private.current_role_is'
                    IN (
                        COALESCE(qual, '')
                        || ' '
                        || COALESCE(with_check, '')
                    )
                ) > 0
            )
        ORDER BY
            tablename,
            policyname
    LOOP

        EXECUTE format(
            'ALTER POLICY %I ON public.%I TO authenticated',
            r.policyname,
            r.tablename
        );

        v_count := v_count + 1;

    END LOOP;


    IF v_count <> 40 THEN
        RAISE EXCEPTION
            'Phase12B.2C: policies normalisées: %, attendu 40',
            v_count;
    END IF;

END
$phase12b2c_normalize_roles$;


-- ------------------------------------------------------------
-- 3. Ajouter le guard lifecycle à toutes les policies ayant
--    une branche auth.uid().
--
-- On conserve intégralement l'expression historique et on
-- l'encapsule avec current_account_is_active().
-- ------------------------------------------------------------

DO $phase12b2c_guard_uid$
DECLARE
    r record;
    v_sql text;
    v_count integer := 0;
BEGIN

    FOR r IN
        SELECT
            tablename,
            policyname,
            cmd,
            qual,
            with_check
        FROM pg_policies
        WHERE
            schemaname = 'public'
            AND POSITION(
                'auth.uid()'
                IN (
                    COALESCE(qual, '')
                    || ' '
                    || COALESCE(with_check, '')
                )
            ) > 0
            AND POSITION(
                'private.current_account_is_active'
                IN (
                    COALESCE(qual, '')
                    || ' '
                    || COALESCE(with_check, '')
                )
            ) = 0
        ORDER BY
            tablename,
            policyname
    LOOP

        v_sql := format(
            'ALTER POLICY %I ON public.%I',
            r.policyname,
            r.tablename
        );


        IF r.qual IS NOT NULL THEN

            v_sql := (
                v_sql
                || format(
                    ' USING ((SELECT private.current_account_is_active()) AND (%s))',
                    r.qual
                )
            );

        END IF;


        IF r.with_check IS NOT NULL THEN

            v_sql := (
                v_sql
                || format(
                    ' WITH CHECK ((SELECT private.current_account_is_active()) AND (%s))',
                    r.with_check
                )
            );

        END IF;


        EXECUTE v_sql;

        v_count := v_count + 1;

    END LOOP;


    IF v_count <> 46 THEN
        RAISE EXCEPTION
            'Phase12B.2C: policies auth.uid protégées: %, attendu 46',
            v_count;
    END IF;

END
$phase12b2c_guard_uid$;


-- ------------------------------------------------------------
-- 4. Lecture interne geo_reference_gaps
--
-- Contrairement aux référentiels géographiques publics,
-- cette policy est réservée aux utilisateurs authentifiés.
-- ------------------------------------------------------------

ALTER POLICY "geo authenticated read gaps"
ON public.geo_reference_gaps
USING (
    (SELECT private.current_account_is_active())
);


-- ------------------------------------------------------------
-- 5. Assertions post-migration.
-- ------------------------------------------------------------

DO $phase12b2c_postconditions$
DECLARE
    v_total_policies integer;
    v_uid_policies integer;
    v_uid_guarded integer;
    v_private_public_remaining integer;
    v_public_address_policies integer;
    v_geo_gap_guarded integer;

    v_current_role_definition text;
    v_current_role_security_definer boolean;
    v_current_role_volatility "char";
    v_current_role_config text[];

    v_anon_execute boolean;
    v_authenticated_execute boolean;
    v_service_role_execute boolean;
BEGIN

    SELECT COUNT(*)
    INTO v_total_policies
    FROM pg_policies
    WHERE schemaname = 'public';

    IF v_total_policies <> 102 THEN
        RAISE EXCEPTION
            'Phase12B.2C post: total policies inattendu: %',
            v_total_policies;
    END IF;


    SELECT COUNT(*)
    INTO v_uid_policies
    FROM pg_policies
    WHERE
        schemaname = 'public'
        AND POSITION(
            'auth.uid()'
            IN (
                COALESCE(qual, '')
                || ' '
                || COALESCE(with_check, '')
            )
        ) > 0;

    IF v_uid_policies <> 46 THEN
        RAISE EXCEPTION
            'Phase12B.2C post: policies auth.uid inattendues: %',
            v_uid_policies;
    END IF;


    SELECT COUNT(*)
    INTO v_uid_guarded
    FROM pg_policies
    WHERE
        schemaname = 'public'
        AND POSITION(
            'auth.uid()'
            IN (
                COALESCE(qual, '')
                || ' '
                || COALESCE(with_check, '')
            )
        ) > 0
        AND POSITION(
            'private.current_account_is_active'
            IN (
                COALESCE(qual, '')
                || ' '
                || COALESCE(with_check, '')
            )
        ) > 0;

    IF v_uid_guarded <> 46 THEN
        RAISE EXCEPTION
            'Phase12B.2C post: policies UID lifecycle-aware: %, attendu 46',
            v_uid_guarded;
    END IF;


    SELECT COUNT(*)
    INTO v_private_public_remaining
    FROM pg_policies
    WHERE
        schemaname = 'public'
        AND 'public'::name = ANY(roles)
        AND (
            POSITION(
                'auth.uid()'
                IN (
                    COALESCE(qual, '')
                    || ' '
                    || COALESCE(with_check, '')
                )
            ) > 0
            OR
            POSITION(
                'private.current_role_is'
                IN (
                    COALESCE(qual, '')
                    || ' '
                    || COALESCE(with_check, '')
                )
            ) > 0
        );

    IF v_private_public_remaining <> 0 THEN
        RAISE EXCEPTION
            'Phase12B.2C post: policies privées encore TO public: %',
            v_private_public_remaining;
    END IF;


    SELECT COUNT(*)
    INTO v_public_address_policies
    FROM pg_policies
    WHERE
        schemaname = 'public'
        AND tablename = 'addresses'
        AND policyname = 'public read addresses'
        AND cmd = 'SELECT'
        AND 'public'::name = ANY(roles)
        AND POSITION(
            'visibility'
            IN COALESCE(qual, '')
        ) > 0
        AND POSITION(
            '''public'''
            IN COALESCE(qual, '')
        ) > 0
        AND POSITION(
            'status'
            IN COALESCE(qual, '')
        ) > 0
        AND POSITION(
            '''active'''
            IN COALESCE(qual, '')
        ) > 0
        AND POSITION(
            'current_account_is_active'
            IN COALESCE(qual, '')
        ) = 0;

    IF v_public_address_policies <> 1 THEN
        RAISE EXCEPTION
            'Phase12B.2C post: public read addresses modifiée';
    END IF;


    SELECT COUNT(*)
    INTO v_geo_gap_guarded
    FROM pg_policies
    WHERE
        schemaname = 'public'
        AND tablename = 'geo_reference_gaps'
        AND policyname = 'geo authenticated read gaps'
        AND POSITION(
            'private.current_account_is_active'
            IN COALESCE(qual, '')
        ) > 0;

    IF v_geo_gap_guarded <> 1 THEN
        RAISE EXCEPTION
            'Phase12B.2C post: geo gaps non lifecycle-aware';
    END IF;


    SELECT
        pg_get_functiondef(p.oid),
        p.prosecdef,
        p.provolatile,
        p.proconfig
    INTO
        v_current_role_definition,
        v_current_role_security_definer,
        v_current_role_volatility,
        v_current_role_config
    FROM pg_proc p
    JOIN pg_namespace n
        ON n.oid = p.pronamespace
    WHERE
        n.nspname = 'private'
        AND p.proname = 'current_role_is'
        AND pg_get_function_identity_arguments(
            p.oid
        ) = 'target_roles text[]'
    LIMIT 1;


    IF POSITION(
        'account_status'
        IN v_current_role_definition
    ) = 0 THEN
        RAISE EXCEPTION
            'Phase12B.2C post: current_role_is sans account_status';
    END IF;


    IF v_current_role_security_definer IS NOT TRUE THEN
        RAISE EXCEPTION
            'Phase12B.2C post: current_role_is non SECURITY DEFINER';
    END IF;


    IF v_current_role_volatility <> 's' THEN
        RAISE EXCEPTION
            'Phase12B.2C post: current_role_is non STABLE';
    END IF;


    IF NOT (
        v_current_role_config
        @> ARRAY['search_path=""']::text[]
    ) THEN
        RAISE EXCEPTION
            'Phase12B.2C post: search_path current_role_is non vide';
    END IF;


    SELECT
        has_function_privilege(
            'anon',
            'private.current_role_is(text[])',
            'EXECUTE'
        ),
        has_function_privilege(
            'authenticated',
            'private.current_role_is(text[])',
            'EXECUTE'
        ),
        has_function_privilege(
            'service_role',
            'private.current_role_is(text[])',
            'EXECUTE'
        )
    INTO
        v_anon_execute,
        v_authenticated_execute,
        v_service_role_execute;


    IF v_anon_execute IS NOT FALSE THEN
        RAISE EXCEPTION
            'Phase12B.2C post: anon EXECUTE current_role_is';
    END IF;


    IF v_authenticated_execute IS NOT TRUE THEN
        RAISE EXCEPTION
            'Phase12B.2C post: authenticated sans current_role_is';
    END IF;


    IF v_service_role_execute IS NOT TRUE THEN
        RAISE EXCEPTION
            'Phase12B.2C post: service_role sans current_role_is';
    END IF;

END
$phase12b2c_postconditions$;