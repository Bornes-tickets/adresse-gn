-- ============ CMS : pages ============
CREATE TABLE public.cms_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  title jsonb NOT NULL DEFAULT '{}'::jsonb,
  excerpt jsonb NOT NULL DEFAULT '{}'::jsonb,
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  seo_title jsonb NOT NULL DEFAULT '{}'::jsonb,
  seo_description jsonb NOT NULL DEFAULT '{}'::jsonb,
  cover_url text,
  position integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cms_pages TO anon, authenticated;
GRANT ALL ON public.cms_pages TO service_role;
ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cms_pages_public_read" ON public.cms_pages FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "cms_pages_admin_read" ON public.cms_pages FOR SELECT TO authenticated USING (private.current_role_is(ARRAY['admin','super_admin']));

-- ============ CMS : blog ============
CREATE TABLE public.cms_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  category text,
  cover_url text,
  title jsonb NOT NULL DEFAULT '{}'::jsonb,
  excerpt jsonb NOT NULL DEFAULT '{}'::jsonb,
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  seo_title jsonb NOT NULL DEFAULT '{}'::jsonb,
  seo_description jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cms_posts TO anon, authenticated;
GRANT ALL ON public.cms_posts TO service_role;
ALTER TABLE public.cms_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cms_posts_public_read" ON public.cms_posts FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "cms_posts_admin_read" ON public.cms_posts FOR SELECT TO authenticated USING (private.current_role_is(ARRAY['admin','super_admin']));

-- ============ CMS : FAQ ============
CREATE TABLE public.cms_faq (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text,
  question jsonb NOT NULL DEFAULT '{}'::jsonb,
  answer jsonb NOT NULL DEFAULT '{}'::jsonb,
  position integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cms_faq TO anon, authenticated;
GRANT ALL ON public.cms_faq TO service_role;
ALTER TABLE public.cms_faq ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cms_faq_public_read" ON public.cms_faq FOR SELECT TO anon, authenticated USING (published);
CREATE POLICY "cms_faq_admin_read" ON public.cms_faq FOR SELECT TO authenticated USING (private.current_role_is(ARRAY['admin','super_admin']));

-- ============ CMS : traductions ============
CREATE TABLE public.cms_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace text NOT NULL DEFAULT 'common',
  key text NOT NULL,
  fr text,
  en text,
  ar text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (namespace, key)
);
GRANT SELECT ON public.cms_translations TO anon, authenticated;
GRANT ALL ON public.cms_translations TO service_role;
ALTER TABLE public.cms_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cms_translations_public_read" ON public.cms_translations FOR SELECT TO anon, authenticated USING (true);

-- ============ CMS : offres tarifaires ============
CREATE TABLE public.cms_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name jsonb NOT NULL DEFAULT '{}'::jsonb,
  description jsonb NOT NULL DEFAULT '{}'::jsonb,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  price_gnf bigint NOT NULL DEFAULT 0,
  period text NOT NULL DEFAULT 'once' CHECK (period IN ('once','month','year')),
  popular boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cms_plans TO anon, authenticated;
GRANT ALL ON public.cms_plans TO service_role;
ALTER TABLE public.cms_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cms_plans_public_read" ON public.cms_plans FOR SELECT TO anon, authenticated USING (active);
CREATE POLICY "cms_plans_admin_read" ON public.cms_plans FOR SELECT TO authenticated USING (private.current_role_is(ARRAY['admin','super_admin']));

-- ============ updated_at ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_cms_pages_updated BEFORE UPDATE ON public.cms_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cms_posts_updated BEFORE UPDATE ON public.cms_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cms_faq_updated BEFORE UPDATE ON public.cms_faq FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cms_translations_updated BEFORE UPDATE ON public.cms_translations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cms_plans_updated BEFORE UPDATE ON public.cms_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Contenus de démonstration ============
INSERT INTO public.cms_pages (slug, status, title, excerpt, body, seo_title, seo_description, published_at) VALUES
('a-propos', 'published',
 '{"fr":"À propos","en":"About","ar":"من نحن"}',
 '{"fr":"Notre mission : donner une adresse à chacun.","en":"Our mission: an address for everyone.","ar":"مهمتنا: عنوان للجميع."}',
 '{"fr":"Adresse GN construit le premier réseau d''adresses numériques de Guinée.","en":"Adresse GN builds Guinea''s first digital address network.","ar":"تبني Adresse GN أول شبكة عناوين رقمية في غينيا."}',
 '{"fr":"À propos — Adresse GN","en":"About — Adresse GN","ar":"من نحن — Adresse GN"}',
 '{"fr":"Découvrez la mission d''Adresse GN.","en":"Discover the mission of Adresse GN.","ar":"تعرف على مهمة Adresse GN."}',
 now()),
('confidentialite', 'published',
 '{"fr":"Confidentialité","en":"Privacy","ar":"الخصوصية"}',
 '{"fr":"Vos données restent privées par défaut.","en":"Your data stays private by default.","ar":"بياناتك خاصة بشكل افتراضي."}',
 '{"fr":"Nous ne publions jamais une adresse privée sans consentement.","en":"We never publish a private address without consent.","ar":"لا ننشر أي عنوان خاص دون موافقة."}',
 '{"fr":"Confidentialité — Adresse GN","en":"Privacy — Adresse GN","ar":"الخصوصية — Adresse GN"}',
 '{"fr":"Politique de confidentialité d''Adresse GN.","en":"Privacy policy of Adresse GN.","ar":"سياسة الخصوصية."}',
 now());

INSERT INTO public.cms_posts (slug, status, category, title, excerpt, body, published_at) VALUES
('lancement-adresse-gn', 'published', 'Annonces',
 '{"fr":"Lancement d''Adresse GN à Conakry","en":"Adresse GN launches in Conakry","ar":"انطلاق Adresse GN في كوناكري"}',
 '{"fr":"Les premières balises sont installées.","en":"The first beacons are installed.","ar":"تم تثبيت أول العلامات."}',
 '{"fr":"Le déploiement démarre dans les cinq communes de Conakry.","en":"Rollout starts across the five communes of Conakry.","ar":"يبدأ النشر في بلديات كوناكري الخمس."}',
 now());

INSERT INTO public.cms_faq (category, question, answer, position) VALUES
('Général',
 '{"fr":"Qu''est-ce qu''une balise Adresse GN ?","en":"What is an Adresse GN beacon?","ar":"ما هي علامة Adresse GN؟"}',
 '{"fr":"Une plaque avec un numéro unique et un QR code posée à votre entrée.","en":"A plate with a unique number and QR code installed at your entrance.","ar":"لوحة تحمل رقماً فريداً ورمز QR تُثبت عند مدخلك."}',
 1),
('Livraison',
 '{"fr":"Comment un livreur me trouve-t-il ?","en":"How does a courier find me?","ar":"كيف يجدني عامل التوصيل؟"}',
 '{"fr":"Il saisit votre numéro sur le site et lance l''itinéraire.","en":"They enter your number on the site and start navigation.","ar":"يدخل رقمك في الموقع ويبدأ الملاحة."}',
 2);

INSERT INTO public.cms_translations (namespace, key, fr, en, ar) VALUES
('common', 'nav.pricing', 'Tarifs', 'Pricing', 'الأسعار'),
('common', 'nav.about', 'À propos', 'About', 'من نحن'),
('common', 'cta.order', 'Commander', 'Order now', 'اطلب الآن');

INSERT INTO public.cms_plans (code, name, description, features, price_gnf, period, popular, position) VALUES
('particulier',
 '{"fr":"Particulier","en":"Individual","ar":"فرد"}',
 '{"fr":"Une balise pour votre domicile.","en":"One beacon for your home.","ar":"علامة واحدة لمنزلك."}',
 '{"fr":["Balise + QR code","Installation GPS","Fiche adresse partageable"],"en":["Beacon + QR code","GPS installation","Shareable address page"],"ar":["علامة + رمز QR","تثبيت بنظام GPS","صفحة عنوان قابلة للمشاركة"]}',
 150000, 'once', true, 1),
('pro',
 '{"fr":"Professionnel","en":"Business","ar":"احترافي"}',
 '{"fr":"Pour commerces et entreprises.","en":"For shops and companies.","ar":"للمتاجر والشركات."}',
 '{"fr":["Fiche établissement","Photos et horaires","Statistiques de visite"],"en":["Business page","Photos and opening hours","Visit statistics"],"ar":["صفحة المنشأة","صور ومواعيد العمل","إحصاءات الزيارات"]}',
 450000, 'year', false, 2);