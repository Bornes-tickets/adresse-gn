REVOKE SELECT ON public.beacons FROM anon, authenticated;
GRANT SELECT (id, public_number, status, lot_id, created_at, activated_at, assigned_agent_id, category) ON public.beacons TO authenticated;