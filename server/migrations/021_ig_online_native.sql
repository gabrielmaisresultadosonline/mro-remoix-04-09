-- IG ONLINE nativo no PostgreSQL da VPS: histórico de bloqueios e proteção
-- contra incrementos duplicados de boas-vindas. Aditivo e idempotente.

-- Garante colunas das etapas anteriores (caso 020 tenha sido pulada).
ALTER TABLE public.ig_online_sessions ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.ig_online_sessions ADD COLUMN IF NOT EXISTS block_message TEXT;
ALTER TABLE public.ig_online_sessions ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;
ALTER TABLE public.ig_online_sessions ADD COLUMN IF NOT EXISTS unblocked_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.ig_online_block_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_username TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('blocked','unblocked','message_updated')),
  block_message TEXT,
  admin_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ig_online_block_history_ig_idx
  ON public.ig_online_block_history (lower(instagram_username), created_at DESC);

-- request_id enviado pela extensão: a mesma requisição repetida não soma duas vezes.
CREATE TABLE IF NOT EXISTS public.ig_online_metric_requests (
  request_id TEXT PRIMARY KEY,
  instagram_username TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ig_online_metric_requests_created_idx
  ON public.ig_online_metric_requests (created_at);

GRANT ALL ON public.ig_online_block_history TO service_role;
GRANT ALL ON public.ig_online_metric_requests TO service_role;
ALTER TABLE public.ig_online_block_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_online_metric_requests ENABLE ROW LEVEL SECURITY;
