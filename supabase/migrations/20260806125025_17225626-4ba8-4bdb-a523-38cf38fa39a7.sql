-- 1. Private schema for internal helper functions
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

-- Move internal functions out of the API-exposed public schema.
-- Existing RLS policies and triggers reference these functions by OID,
-- so they keep working unchanged after the schema move.
ALTER FUNCTION public.current_role_is(text[]) SET SCHEMA private;
ALTER FUNCTION public.handle_new_user() SET SCHEMA private;

REVOKE ALL ON FUNCTION private.current_role_is(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_role_is(text[]) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.handle_new_user() TO service_role;

-- 2. PostGIS technical functions must not be callable through the public API
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_depend d
    JOIN pg_extension e ON e.oid = d.refobjid AND e.extname = 'postgis'
    JOIN pg_proc p ON p.oid = d.objid
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    WHERE d.deptype = 'e' AND d.classid = 'pg_proc'::regclass
  LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', r.sig);
    EXCEPTION WHEN insufficient_privilege OR undefined_object THEN
      NULL;
    END;
  END LOOP;
END $$;

-- Keep the product's core search function exactly as created previously:
-- SECURITY DEFINER, callable by anon and authenticated.
GRANT EXECUTE ON FUNCTION public.search_by_number(text) TO anon, authenticated, service_role;

-- 3. PostGIS technical table: not readable through the public API
DO $$
BEGIN
  EXECUTE 'REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon, authenticated';
EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
  NULL;
END $$;