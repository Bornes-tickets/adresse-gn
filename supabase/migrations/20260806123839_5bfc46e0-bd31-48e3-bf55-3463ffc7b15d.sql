CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user','business_owner','agent','supervisor','qc','commercial','admin','super_admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. regions
CREATE TABLE regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'GN'
);

-- 3. communes
CREATE TABLE communes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID REFERENCES regions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  boundary GEOGRAPHY(POLYGON, 4326)
);

-- 4. districts
CREATE TABLE districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_id UUID REFERENCES communes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  boundary GEOGRAPHY(POLYGON, 4326)
);

-- 5. lots
CREATE TABLE lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  quantity INT NOT NULL,
  supplier TEXT,
  received_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('ordered','received','in_use','depleted','recalled'))
);

-- 6. beacons
CREATE TABLE beacons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_number TEXT UNIQUE NOT NULL,
  qr_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'generated'
    CHECK (status IN ('generated','assigned','installed','active','suspended','replaced','cancelled')),
  lot_id UUID REFERENCES lots(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  activated_at TIMESTAMPTZ
);
CREATE INDEX idx_beacons_status ON beacons(status);

-- 7. addresses
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beacon_id UUID UNIQUE REFERENCES beacons(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES profiles(id),
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('habitation','restaurant','hotel','bar','commerce','entreprise','administration','ecole','sante','pharmacie','banque','tourisme','other')),
  name TEXT,
  location GEOGRAPHY(POINT, 4326),
  accuracy_m NUMERIC(6,2),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public')),
  verification_level TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_level IN ('unverified','pending','verified')),
  access_point_note TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','suspended','deleted')),
  commune_id UUID REFERENCES communes(id),
  district_id UUID REFERENCES districts(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_addresses_location ON addresses USING GIST(location);
CREATE INDEX idx_addresses_visibility_status ON addresses(visibility, status);

-- 8. establishments
CREATE TABLE establishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_id UUID UNIQUE REFERENCES addresses(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  phone TEXT,
  opening_hours JSONB,
  description TEXT,
  cover_url TEXT
);
CREATE INDEX idx_establishments_search ON establishments
  USING GIN (to_tsvector('french', business_name || ' ' || COALESCE(description,'')));

-- 9. establishment_photos
CREATE TABLE establishment_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID REFERENCES establishments(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  "order" INT DEFAULT 0
);

-- 10. agents
CREATE TABLE agents (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  badge_number TEXT UNIQUE NOT NULL,
  zone_id UUID REFERENCES communes(id),
  active BOOLEAN DEFAULT true,
  hired_at DATE
);

-- 11. installations
CREATE TABLE installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beacon_id UUID REFERENCES beacons(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id),
  gps_lat NUMERIC(10,7) NOT NULL,
  gps_lng NUMERIC(10,7) NOT NULL,
  accuracy_m NUMERIC(6,2),
  photo_url TEXT,
  installed_at TIMESTAMPTZ DEFAULT now(),
  validated_at TIMESTAMPTZ,
  validator_id UUID REFERENCES profiles(id)
);

-- 12. installation_measures
CREATE TABLE installation_measures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID REFERENCES installations(id) ON DELETE CASCADE,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  accuracy_m NUMERIC(6,2),
  taken_at TIMESTAMPTZ DEFAULT now()
);

-- 13. organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('livraison','banque','assurance','commune','administration','autre')),
  contact_id UUID REFERENCES profiles(id)
);

-- 14. orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES profiles(id),
  offer_code TEXT NOT NULL,
  amount_gnf BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','cancelled','refunded')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 15. payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT CHECK (provider IN ('orange','mtn','card','cash','transfer')),
  external_ref TEXT,
  amount_gnf BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','success','failed','refunded')),
  paid_at TIMESTAMPTZ
);

-- 16. subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES profiles(id),
  plan_code TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','expired','cancelled','suspended')),
  price_gnf BIGINT NOT NULL
);

-- 17. invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  number TEXT UNIQUE NOT NULL,
  pdf_url TEXT,
  issued_at TIMESTAMPTZ DEFAULT now()
);

-- 18. reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beacon_id UUID REFERENCES beacons(id),
  reporter_id UUID REFERENCES profiles(id),
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','in_review','resolved','rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 19. favorites
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  beacon_id UUID REFERENCES beacons(id),
  alias TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, beacon_id)
);

-- 20. search_logs
CREATE TABLE search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  beacon_id_found UUID REFERENCES beacons(id),
  user_id UUID REFERENCES profiles(id),
  ip INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 21. route_logs
CREATE TABLE route_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beacon_id UUID REFERENCES beacons(id),
  user_id UUID REFERENCES profiles(id),
  provider TEXT CHECK (provider IN ('google','waze','apple','other')),
  launched_at TIMESTAMPTZ DEFAULT now()
);

-- 22. audit_logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 23. api_keys
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  scopes TEXT[] DEFAULT ARRAY['read']::TEXT[],
  quota_month INT DEFAULT 10000,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 24. api_usage
CREATE TABLE api_usage (
  id BIGSERIAL PRIMARY KEY,
  key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint TEXT,
  ts TIMESTAMPTZ DEFAULT now(),
  response_code INT
);

-- 25. notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- GRANTS (requis par PostgREST : aucun privilège par défaut sur le schéma public)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles, public.regions, public.communes,
  public.districts, public.lots, public.beacons, public.addresses, public.establishments,
  public.establishment_photos, public.agents, public.installations, public.installation_measures,
  public.organizations, public.orders, public.payments, public.subscriptions, public.invoices,
  public.reports, public.favorites, public.search_logs, public.route_logs, public.audit_logs,
  public.api_keys, public.api_usage, public.notifications TO authenticated;

GRANT SELECT ON public.regions, public.communes, public.districts, public.beacons,
  public.addresses, public.establishments, public.establishment_photos TO anon;

GRANT ALL ON public.profiles, public.regions, public.communes, public.districts, public.lots,
  public.beacons, public.addresses, public.establishments, public.establishment_photos,
  public.agents, public.installations, public.installation_measures, public.organizations,
  public.orders, public.payments, public.subscriptions, public.invoices, public.reports,
  public.favorites, public.search_logs, public.route_logs, public.audit_logs, public.api_keys,
  public.api_usage, public.notifications TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.api_usage_id_seq TO authenticated, service_role;

-- Trigger auto-création profile
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE communes ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE beacons ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE establishment_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE installation_measures ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper : rôle courant
CREATE OR REPLACE FUNCTION current_role_is(target_roles TEXT[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ANY(target_roles));
$$;

-- POLICIES
CREATE POLICY "own profile read" ON profiles FOR SELECT USING (id = auth.uid() OR current_role_is(ARRAY['admin','super_admin']));
CREATE POLICY "own profile update" ON profiles FOR UPDATE USING (id = auth.uid());

CREATE POLICY "public read" ON regions FOR SELECT USING (true);
CREATE POLICY "public read" ON communes FOR SELECT USING (true);
CREATE POLICY "public read" ON districts FOR SELECT USING (true);
CREATE POLICY "admin write" ON regions FOR ALL USING (current_role_is(ARRAY['admin','super_admin']));
CREATE POLICY "admin write" ON communes FOR ALL USING (current_role_is(ARRAY['admin','super_admin']));
CREATE POLICY "admin write" ON districts FOR ALL USING (current_role_is(ARRAY['admin','super_admin']));

CREATE POLICY "public read beacons" ON beacons FOR SELECT USING (true);
CREATE POLICY "agent write beacons" ON beacons FOR ALL USING (current_role_is(ARRAY['agent','supervisor','admin','super_admin']));

CREATE POLICY "public read addresses" ON addresses FOR SELECT
  USING (visibility = 'public' AND status = 'active');
CREATE POLICY "owner read addresses" ON addresses FOR SELECT
  USING (owner_id = auth.uid() OR current_role_is(ARRAY['admin','supervisor','super_admin']));
CREATE POLICY "owner update addresses" ON addresses FOR UPDATE
  USING (owner_id = auth.uid() OR current_role_is(ARRAY['admin','supervisor','super_admin']));
CREATE POLICY "agent insert addresses" ON addresses FOR INSERT
  WITH CHECK (current_role_is(ARRAY['agent','supervisor','admin','super_admin']));
CREATE POLICY "admin delete addresses" ON addresses FOR DELETE
  USING (current_role_is(ARRAY['admin','super_admin']));

CREATE POLICY "public read establishments" ON establishments FOR SELECT
  USING (EXISTS (SELECT 1 FROM addresses a WHERE a.id = establishments.address_id AND a.visibility = 'public'));
CREATE POLICY "owner write establishments" ON establishments FOR ALL
  USING (EXISTS (SELECT 1 FROM addresses a WHERE a.id = establishments.address_id AND (a.owner_id = auth.uid() OR current_role_is(ARRAY['admin','supervisor']))));
CREATE POLICY "public read photos" ON establishment_photos FOR SELECT USING (true);
CREATE POLICY "owner write photos" ON establishment_photos FOR ALL
  USING (EXISTS (SELECT 1 FROM establishments e JOIN addresses a ON a.id = e.address_id
                 WHERE e.id = establishment_photos.establishment_id
                   AND (a.owner_id = auth.uid() OR current_role_is(ARRAY['admin','supervisor']))));

CREATE POLICY "agent read own installs" ON installations FOR SELECT
  USING (agent_id = auth.uid() OR current_role_is(ARRAY['supervisor','admin','qc','super_admin']));
CREATE POLICY "agent insert installs" ON installations FOR INSERT
  WITH CHECK (agent_id = auth.uid() AND current_role_is(ARRAY['agent']));
CREATE POLICY "supervisor validate installs" ON installations FOR UPDATE
  USING (current_role_is(ARRAY['supervisor','admin','qc','super_admin']));
CREATE POLICY "measures scope" ON installation_measures FOR ALL
  USING (EXISTS (SELECT 1 FROM installations i WHERE i.id = installation_measures.installation_id
                 AND (i.agent_id = auth.uid() OR current_role_is(ARRAY['supervisor','admin','qc','super_admin']))));

CREATE POLICY "admin lots" ON lots FOR ALL USING (current_role_is(ARRAY['admin','supervisor','super_admin']));
CREATE POLICY "admin agents" ON agents FOR ALL USING (current_role_is(ARRAY['admin','supervisor','super_admin']));
CREATE POLICY "agent read own" ON agents FOR SELECT USING (id = auth.uid());
CREATE POLICY "admin orgs" ON organizations FOR ALL USING (current_role_is(ARRAY['admin','super_admin','commercial']));

CREATE POLICY "customer read orders" ON orders FOR SELECT
  USING (customer_id = auth.uid() OR current_role_is(ARRAY['admin','commercial','super_admin']));
CREATE POLICY "customer create orders" ON orders FOR INSERT
  WITH CHECK (customer_id = auth.uid());
CREATE POLICY "customer read payments" ON payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = payments.order_id
                 AND (o.customer_id = auth.uid() OR current_role_is(ARRAY['admin','commercial','super_admin']))));
CREATE POLICY "customer read subs" ON subscriptions FOR SELECT
  USING (customer_id = auth.uid() OR current_role_is(ARRAY['admin','commercial','super_admin']));
CREATE POLICY "customer read invoices" ON invoices FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = invoices.order_id
                 AND (o.customer_id = auth.uid() OR current_role_is(ARRAY['admin','commercial','super_admin']))));

CREATE POLICY "own report read" ON reports FOR SELECT
  USING (reporter_id = auth.uid() OR current_role_is(ARRAY['admin','qc','supervisor','super_admin']));
CREATE POLICY "create report" ON reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "admin update report" ON reports FOR UPDATE
  USING (current_role_is(ARRAY['admin','qc','supervisor','super_admin']));

CREATE POLICY "own favorites" ON favorites FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "admin search_logs" ON search_logs FOR SELECT USING (current_role_is(ARRAY['admin','super_admin']));
CREATE POLICY "admin route_logs" ON route_logs FOR SELECT USING (current_role_is(ARRAY['admin','super_admin']));
CREATE POLICY "admin audit_logs" ON audit_logs FOR SELECT USING (current_role_is(ARRAY['admin','super_admin']));

CREATE POLICY "org api_keys" ON api_keys FOR ALL
  USING (EXISTS (SELECT 1 FROM organizations o WHERE o.id = api_keys.org_id
                 AND (o.contact_id = auth.uid() OR current_role_is(ARRAY['admin','super_admin']))));
CREATE POLICY "org api_usage" ON api_usage FOR SELECT
  USING (EXISTS (SELECT 1 FROM api_keys k JOIN organizations o ON o.id = k.org_id
                 WHERE k.id = api_usage.key_id
                   AND (o.contact_id = auth.uid() OR current_role_is(ARRAY['admin','super_admin']))));

CREATE POLICY "own notifications read" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- Fonction publique search_by_number
CREATE OR REPLACE FUNCTION search_by_number(p_number TEXT)
RETURNS TABLE (
  public_number TEXT,
  name TEXT,
  category TEXT,
  visibility TEXT,
  verification_level TEXT,
  access_point_note TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  business_name TEXT,
  phone TEXT,
  opening_hours JSONB,
  description TEXT,
  cover_url TEXT
)
LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT
    b.public_number,
    a.name,
    a.category,
    a.visibility,
    a.verification_level,
    a.access_point_note,
    ST_Y(a.location::geometry) AS lat,
    ST_X(a.location::geometry) AS lng,
    e.business_name,
    e.phone,
    e.opening_hours,
    e.description,
    e.cover_url
  FROM beacons b
  JOIN addresses a ON a.beacon_id = b.id
  LEFT JOIN establishments e ON e.address_id = a.id
  WHERE UPPER(b.public_number) = UPPER(p_number)
    AND b.status = 'active'
    AND a.status = 'active';
$$;

REVOKE ALL ON FUNCTION search_by_number(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_by_number(TEXT) TO anon, authenticated;

-- ===== SEED =====
INSERT INTO regions (code, name) VALUES ('CKY','Conakry') ON CONFLICT DO NOTHING;

WITH r AS (SELECT id FROM regions WHERE code='CKY')
INSERT INTO communes (region_id, name)
SELECT r.id, x FROM r, unnest(ARRAY['Kaloum','Dixinn','Matam','Ratoma','Matoto']) x
ON CONFLICT DO NOTHING;

INSERT INTO beacons (public_number, status, activated_at) VALUES
  ('GN-CKY-582741','active', now()),
  ('GN-CKY-152963','active', now()),
  ('GN-CKY-759482','active', now()),
  ('GN-CKY-334211','active', now()),
  ('GN-CKY-908177','active', now())
ON CONFLICT DO NOTHING;

INSERT INTO addresses (beacon_id, category, name, location, accuracy_m, visibility, verification_level, access_point_note)
SELECT b.id, s.cat, s.nm,
       ST_SetSRID(ST_MakePoint(s.lng, s.lat),4326)::geography,
       5.0, s.vis, s.ver, s.note
FROM (VALUES
  ('GN-CKY-582741','restaurant','Restaurant Le Damier', 9.5370, -13.6785, 'public','verified','Entrée principale sur rue'),
  ('GN-CKY-152963','hotel','Hôtel Kaloum Palace', 9.5115, -13.7130, 'public','verified','Accès véhicule côté est'),
  ('GN-CKY-759482','habitation','Habitation privée', 9.5645, -13.6420, 'private','unverified','Portail bleu'),
  ('GN-CKY-334211','pharmacie','Pharmacie Ratoma', 9.6120, -13.6350, 'public','verified','Devanture verte'),
  ('GN-CKY-908177','habitation','Habitation privée', 9.5480, -13.6690, 'private','unverified','Maison à étage')
) AS s(num, cat, nm, lat, lng, vis, ver, note)
JOIN beacons b ON b.public_number = s.num
ON CONFLICT DO NOTHING;

INSERT INTO establishments (address_id, business_name, phone, opening_hours, description)
SELECT a.id, s.name, s.phone, s.hours::jsonb, s.descr
FROM (VALUES
  ('GN-CKY-582741','Restaurant Le Damier','+224620000001',
   '{"mon":"08:00-23:00","tue":"08:00-23:00","wed":"08:00-23:00","thu":"08:00-23:00","fri":"08:00-23:00","sat":"08:00-23:00","sun":"12:00-22:00"}',
   'Cuisine guinéenne et internationale, terrasse ombragée.'),
  ('GN-CKY-152963','Hôtel Kaloum Palace','+224620000002',
   '{"reception":"24/7"}',
   '40 chambres, restaurant, salles de séminaire.'),
  ('GN-CKY-334211','Pharmacie Ratoma','+224620000003',
   '{"mon":"08:00-20:00","tue":"08:00-20:00","wed":"08:00-20:00","thu":"08:00-20:00","fri":"08:00-20:00","sat":"08:00-14:00"}',
   'Pharmacie de garde disponible.')
) AS s(num, name, phone, hours, descr)
JOIN beacons b ON b.public_number = s.num
JOIN addresses a ON a.beacon_id = b.id
ON CONFLICT DO NOTHING;