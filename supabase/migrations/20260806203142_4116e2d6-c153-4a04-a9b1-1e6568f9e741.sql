-- ============ claim_requests ============
CREATE TABLE public.claim_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beacon_id UUID NOT NULL REFERENCES public.beacons(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  unclaimed_owner_id UUID REFERENCES public.unclaimed_owners(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  evidence TEXT,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX claim_requests_pending_unique
  ON public.claim_requests (beacon_id, requester_id)
  WHERE status = 'pending';
CREATE INDEX claim_requests_status_idx ON public.claim_requests (status, created_at DESC);

GRANT SELECT, INSERT ON public.claim_requests TO authenticated;
GRANT UPDATE ON public.claim_requests TO authenticated;
GRANT ALL ON public.claim_requests TO service_role;

ALTER TABLE public.claim_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "claim read own or staff" ON public.claim_requests
  FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR private.current_role_is(ARRAY['admin','supervisor','super_admin']));

CREATE POLICY "claim insert own" ON public.claim_requests
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

CREATE POLICY "claim update staff" ON public.claim_requests
  FOR UPDATE TO authenticated
  USING (private.current_role_is(ARRAY['admin','supervisor','super_admin']))
  WITH CHECK (private.current_role_is(ARRAY['admin','supervisor','super_admin']));

-- ============ business_profiles ============
CREATE TABLE public.business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  legal_name TEXT,
  trade_name TEXT NOT NULL,
  category TEXT,
  tax_id TEXT,
  headquarters_address TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  plan_code TEXT CHECK (plan_code IN ('basic','plus','multi_site','institutional')),
  plan_started_at TIMESTAMPTZ,
  plan_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX business_profiles_owner_idx ON public.business_profiles (owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_profiles TO authenticated;
GRANT ALL ON public.business_profiles TO service_role;

ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;

-- ============ team_members ============
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner','editor','viewer')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at TIMESTAMPTZ,
  UNIQUE (business_id, member_id)
);

CREATE INDEX team_members_member_idx ON public.team_members (member_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Helper: appartenance à une business (évite la récursion RLS)
CREATE OR REPLACE FUNCTION private.is_business_member(_business_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_profiles b
    WHERE b.id = _business_id AND b.owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.team_members t
    WHERE t.business_id = _business_id AND t.member_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION private.is_business_owner(_business_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_profiles b
    WHERE b.id = _business_id AND b.owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.team_members t
    WHERE t.business_id = _business_id AND t.member_id = _user_id AND t.role = 'owner'
  );
$$;

REVOKE ALL ON FUNCTION private.is_business_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_business_owner(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_business_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_business_owner(UUID, UUID) TO authenticated;

-- Policies business_profiles
CREATE POLICY "business read own or member" ON public.business_profiles
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR private.is_business_member(id, auth.uid())
    OR private.current_role_is(ARRAY['admin','supervisor','super_admin'])
  );

CREATE POLICY "business insert own" ON public.business_profiles
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "business update own" ON public.business_profiles
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR private.current_role_is(ARRAY['admin','super_admin']))
  WITH CHECK (owner_id = auth.uid() OR private.current_role_is(ARRAY['admin','super_admin']));

CREATE POLICY "business delete own" ON public.business_profiles
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR private.current_role_is(ARRAY['admin','super_admin']));

-- Policies team_members
CREATE POLICY "team read members" ON public.team_members
  FOR SELECT TO authenticated
  USING (
    member_id = auth.uid()
    OR private.is_business_member(business_id, auth.uid())
    OR private.current_role_is(ARRAY['admin','supervisor','super_admin'])
  );

CREATE POLICY "team write owner" ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (private.is_business_owner(business_id, auth.uid()) OR private.current_role_is(ARRAY['admin','super_admin']));

CREATE POLICY "team update owner" ON public.team_members
  FOR UPDATE TO authenticated
  USING (private.is_business_owner(business_id, auth.uid()) OR private.current_role_is(ARRAY['admin','super_admin']))
  WITH CHECK (private.is_business_owner(business_id, auth.uid()) OR private.current_role_is(ARRAY['admin','super_admin']));

CREATE POLICY "team delete owner" ON public.team_members
  FOR DELETE TO authenticated
  USING (private.is_business_owner(business_id, auth.uid()) OR private.current_role_is(ARRAY['admin','super_admin']));

-- updated_at
CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER business_profiles_updated_at
  BEFORE UPDATE ON public.business_profiles
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- Audit
CREATE TRIGGER audit_claim_requests
  AFTER INSERT OR UPDATE OR DELETE ON public.claim_requests
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger();

CREATE TRIGGER audit_business_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.business_profiles
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger();