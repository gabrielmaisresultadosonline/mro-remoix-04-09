-- IG ONLINES — métricas diárias enviadas pela extensão (seguidores, boas-vindas, sessão).
-- Aditivo e idempotente. Acesso somente pelo backend (service_role).

ALTER TABLE public.ig_online_sessions ADD COLUMN IF NOT EXISTS followers_initial BIGINT;
ALTER TABLE public.ig_online_sessions ADD COLUMN IF NOT EXISTS followers_current BIGINT;
ALTER TABLE public.ig_online_sessions ADD COLUMN IF NOT EXISTS welcome_total BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.ig_online_sessions ADD COLUMN IF NOT EXISTS session_started_at TIMESTAMPTZ;
ALTER TABLE public.ig_online_sessions ADD COLUMN IF NOT EXISTS session_ended_at TIMESTAMPTZ;
ALTER TABLE public.ig_online_sessions ADD COLUMN IF NOT EXISTS metrics_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.ig_online_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_username TEXT NOT NULL,
  day DATE NOT NULL,
  followers_start BIGINT,
  followers_end BIGINT,
  welcome_sent BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ig_online_metrics_ig_day_key ON public.ig_online_metrics (lower(instagram_username), day);
CREATE INDEX IF NOT EXISTS ig_online_metrics_day_idx ON public.ig_online_metrics (day DESC);

GRANT ALL ON public.ig_online_metrics TO service_role;
ALTER TABLE public.ig_online_metrics ENABLE ROW LEVEL SECURITY;
