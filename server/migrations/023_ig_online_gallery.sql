-- IG ONLINE: galeria de imagens aprovadas pelos clientes (retenção 30 dias)
-- e contagem de seguidores ganhos enviada como incremento pela extensão.
-- Aditivo e idempotente.

ALTER TABLE public.ig_online_sessions ADD COLUMN IF NOT EXISTS followers_gained_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.ig_online_sessions ADD COLUMN IF NOT EXISTS last_metrics_fields TEXT;
ALTER TABLE public.ig_online_metrics ADD COLUMN IF NOT EXISTS followers_gained INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.ig_online_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_username TEXT NOT NULL,
  publication_id TEXT,
  caption TEXT,
  file_path TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days')
);
CREATE INDEX IF NOT EXISTS ig_online_gallery_created_idx ON public.ig_online_gallery (created_at DESC);
CREATE INDEX IF NOT EXISTS ig_online_gallery_ig_idx ON public.ig_online_gallery (lower(instagram_username));
CREATE INDEX IF NOT EXISTS ig_online_gallery_expires_idx ON public.ig_online_gallery (expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS ig_online_gallery_pub_uq
  ON public.ig_online_gallery (lower(instagram_username), publication_id, file_path);
