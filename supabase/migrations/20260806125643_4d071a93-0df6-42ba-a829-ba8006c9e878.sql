CREATE TABLE public.rate_limits (
  ip TEXT NOT NULL,
  minute_bucket TIMESTAMPTZ NOT NULL,
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (ip, minute_bucket)
);

GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no direct access to rate_limits" ON public.rate_limits FOR SELECT USING (false);

CREATE TABLE public.search_misses (
  ip TEXT PRIMARY KEY,
  miss_count INT NOT NULL DEFAULT 0,
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.search_misses TO service_role;
ALTER TABLE public.search_misses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no direct access to search_misses" ON public.search_misses FOR SELECT USING (false);