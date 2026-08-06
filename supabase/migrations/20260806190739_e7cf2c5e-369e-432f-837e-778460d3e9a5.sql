-- 1) Fonction trigger générique d'audit (schéma privé, non exposée à l'API)
CREATE OR REPLACE FUNCTION private.audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_entity_id uuid;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_before := to_jsonb(OLD);
    v_after := NULL;
    v_entity_id := (to_jsonb(OLD) ->> 'id')::uuid;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    v_entity_id := (to_jsonb(NEW) ->> 'id')::uuid;
  ELSE
    v_before := NULL;
    v_after := to_jsonb(NEW);
    v_entity_id := (to_jsonb(NEW) ->> 'id')::uuid;
  END IF;

  IF v_actor IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_actor) THEN
    v_actor := NULL;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, before, after)
  VALUES (v_actor, lower(TG_OP), TG_TABLE_NAME, v_entity_id, v_before, v_after);

  IF (TG_OP = 'DELETE') THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.audit_trigger() FROM PUBLIC;

-- 2) Attache le trigger aux tables sensibles
DROP TRIGGER IF EXISTS audit_addresses ON public.addresses;
CREATE TRIGGER audit_addresses AFTER INSERT OR UPDATE OR DELETE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger();

DROP TRIGGER IF EXISTS audit_beacons ON public.beacons;
CREATE TRIGGER audit_beacons AFTER INSERT OR UPDATE OR DELETE ON public.beacons
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger();

DROP TRIGGER IF EXISTS audit_agents ON public.agents;
CREATE TRIGGER audit_agents AFTER INSERT OR UPDATE OR DELETE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger();

DROP TRIGGER IF EXISTS audit_orders ON public.orders;
CREATE TRIGGER audit_orders AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger();

DROP TRIGGER IF EXISTS audit_payments ON public.payments;
CREATE TRIGGER audit_payments AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger();

DROP TRIGGER IF EXISTS audit_subscriptions ON public.subscriptions;
CREATE TRIGGER audit_subscriptions AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION private.audit_trigger();

-- 3) Index de performance pour les listes du back-office
CREATE INDEX IF NOT EXISTS idx_beacons_status ON public.beacons (status);
CREATE INDEX IF NOT EXISTS idx_beacons_lot ON public.beacons (lot_id);
CREATE INDEX IF NOT EXISTS idx_beacons_created_at ON public.beacons (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_addresses_status ON public.addresses (status);
CREATE INDEX IF NOT EXISTS idx_addresses_visibility ON public.addresses (visibility);
CREATE INDEX IF NOT EXISTS idx_addresses_category ON public.addresses (category);
CREATE INDEX IF NOT EXISTS idx_addresses_commune ON public.addresses (commune_id);
CREATE INDEX IF NOT EXISTS idx_addresses_created_at ON public.addresses (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_installations_agent ON public.installations (agent_id);
CREATE INDEX IF NOT EXISTS idx_installations_installed_at ON public.installations (installed_at DESC);
CREATE INDEX IF NOT EXISTS idx_installations_validated_at ON public.installations (validated_at);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports (status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON public.search_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_route_logs_launched_at ON public.route_logs (launched_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity, entity_id);