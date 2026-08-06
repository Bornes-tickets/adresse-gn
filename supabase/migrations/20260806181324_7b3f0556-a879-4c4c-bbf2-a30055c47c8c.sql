-- 1) Assignation agent <-> lot
CREATE TABLE public.lot_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lot_id, agent_id)
);

GRANT SELECT ON public.lot_assignments TO authenticated;
GRANT ALL ON public.lot_assignments TO service_role;

ALTER TABLE public.lot_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own or supervisor" ON public.lot_assignments
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR private.current_role_is(ARRAY['supervisor','admin','super_admin']));

CREATE POLICY "supervisor manage" ON public.lot_assignments
  FOR ALL TO authenticated
  USING (private.current_role_is(ARRAY['supervisor','admin','super_admin']))
  WITH CHECK (private.current_role_is(ARRAY['supervisor','admin','super_admin']));

CREATE INDEX lot_assignments_agent_idx ON public.lot_assignments(agent_id);

-- 2) Propriétaires non encore inscrits (traçabilité du consentement)
CREATE TABLE public.unclaimed_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beacon_id UUID NOT NULL REFERENCES public.beacons(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  consent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.unclaimed_owners TO authenticated;
GRANT ALL ON public.unclaimed_owners TO service_role;

ALTER TABLE public.unclaimed_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read" ON public.unclaimed_owners
  FOR SELECT TO authenticated
  USING (private.current_role_is(ARRAY['supervisor','admin','qc','super_admin']));

CREATE POLICY "agent insert" ON public.unclaimed_owners
  FOR INSERT TO authenticated
  WITH CHECK (private.current_role_is(ARRAY['agent','supervisor','admin','super_admin']));

CREATE INDEX unclaimed_owners_beacon_idx ON public.unclaimed_owners(beacon_id);

-- 3) Seed : LOT-DEMO-001 -> agent AG001
INSERT INTO public.lot_assignments (lot_id, agent_id)
SELECT l.id, a.id
FROM public.lots l
CROSS JOIN public.agents a
WHERE l.code = 'LOT-DEMO-001' AND a.badge_number = 'AG001'
ON CONFLICT (lot_id, agent_id) DO NOTHING;