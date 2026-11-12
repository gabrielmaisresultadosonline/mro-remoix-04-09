-- IG ONLINE: atividade diária, histórico de destinatários e criativos por conta.
-- Aditivo e idempotente: preserva todas as métricas, imagens e sessões existentes.

ALTER TABLE public.ig_online_sessions ADD COLUMN IF NOT EXISTS likes_total BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.ig_online_sessions ADD COLUMN IF NOT EXISTS follows_total BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.ig_online_sessions ADD COLUMN IF NOT EXISTS unfollows_total BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.ig_online_sessions ADD COLUMN IF NOT EXISTS ai_replies_total BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.ig_online_sessions ADD COLUMN IF NOT EXISTS ai_people_total BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.ig_online_sessions ADD COLUMN IF NOT EXISTS mass_sent_total BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.ig_online_metrics ADD COLUMN IF NOT EXISTS likes_sent BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.ig_online_metrics ADD COLUMN IF NOT EXISTS follows_sent BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.ig_online_metrics ADD COLUMN IF NOT EXISTS unfollows_sent BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.ig_online_metrics ADD COLUMN IF NOT EXISTS ai_replies_sent BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.ig_online_metrics ADD COLUMN IF NOT EXISTS ai_people_replied BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.ig_online_metrics ADD COLUMN IF NOT EXISTS mass_sent BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.ig_online_outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT,
  instagram_username TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('welcome','mass')),
  recipient TEXT NOT NULL,
  campaign_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ig_online_outreach_event_uq
  ON public.ig_online_outreach (event_id) WHERE event_id IS NOT NULL;
-- Um destinatário por tipo: a extensão consulta este histórico antes de reenviar.
CREATE UNIQUE INDEX IF NOT EXISTS ig_online_outreach_recipient_uq
  ON public.ig_online_outreach (lower(instagram_username), kind, lower(recipient));
CREATE INDEX IF NOT EXISTS ig_online_outreach_history_idx
  ON public.ig_online_outreach (lower(instagram_username), kind, sent_at DESC);

CREATE TABLE IF NOT EXISTS public.ig_online_creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_username TEXT NOT NULL,
  publication_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','scheduled','published','cancelled','failed')),
  caption TEXT,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ig_online_creatives_pub_uq
  ON public.ig_online_creatives (lower(instagram_username), publication_id);
CREATE INDEX IF NOT EXISTS ig_online_creatives_history_idx
  ON public.ig_online_creatives (lower(instagram_username), updated_at DESC);
CREATE INDEX IF NOT EXISTS ig_online_creatives_status_idx
  ON public.ig_online_creatives (status, updated_at DESC);

GRANT ALL ON public.ig_online_outreach TO service_role;
GRANT ALL ON public.ig_online_creatives TO service_role;
ALTER TABLE public.ig_online_outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_online_creatives ENABLE ROW LEVEL SECURITY;
