-- Painel /instagram-nova-euro/admin: vídeo próprio da página e registro de acessos (retenção 90 dias).
CREATE TABLE IF NOT EXISTS public.euro_page_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_url text,
  hls_url text,
  video_title text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.euro_page_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text,
  country text,
  region text,
  city text,
  path text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS euro_page_visits_created_idx ON public.euro_page_visits (created_at DESC);

GRANT ALL ON public.euro_page_settings TO service_role;
GRANT ALL ON public.euro_page_visits TO service_role;
ALTER TABLE public.euro_page_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.euro_page_visits ENABLE ROW LEVEL SECURITY;
