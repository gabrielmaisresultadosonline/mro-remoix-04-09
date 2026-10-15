-- IG ONLINES: monitoramento interno dos perfis do Instagram logados na extensão.
-- Aditivo e idempotente. Acesso somente pelo backend (service_role / adminQuery).

CREATE TABLE IF NOT EXISTS public.ig_online_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_username TEXT NOT NULL,
  mro_username TEXT,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('client','trial','unknown')),
  flagged BOOLEAN NOT NULL DEFAULT false,
  browser TEXT NOT NULL DEFAULT '',
  os TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  ip TEXT,
  last_url TEXT,
  extension_version TEXT,
  total_pings BIGINT NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ig_online_sessions_ig_key ON public.ig_online_sessions (lower(instagram_username));
CREATE INDEX IF NOT EXISTS ig_online_sessions_last_seen_idx ON public.ig_online_sessions (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS ig_online_sessions_status_idx ON public.ig_online_sessions (status);

CREATE TABLE IF NOT EXISTS public.ig_online_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.ig_online_sessions(id) ON DELETE CASCADE,
  instagram_username TEXT NOT NULL,
  mro_username TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  browser TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  ip TEXT,
  url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ig_online_events_ig_idx ON public.ig_online_events (lower(instagram_username), created_at DESC);
CREATE INDEX IF NOT EXISTS ig_online_events_created_idx ON public.ig_online_events (created_at DESC);

CREATE TABLE IF NOT EXISTS public.ig_online_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_instagram TEXT,
  target_scope TEXT NOT NULL DEFAULT 'one' CHECK (target_scope IN ('one','all','unknown')),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  buttons JSONB NOT NULL DEFAULT '[]'::jsonb,
  blocking BOOLEAN NOT NULL DEFAULT false,
  lock_seconds INTEGER NOT NULL DEFAULT 0,
  repeat_daily BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ig_online_messages_target_idx ON public.ig_online_messages (lower(coalesce(target_instagram,'')), active);

CREATE TABLE IF NOT EXISTS public.ig_online_message_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.ig_online_messages(id) ON DELETE CASCADE,
  instagram_username TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('delivered','shown','closed','clicked')),
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ig_online_message_events_msg_idx ON public.ig_online_message_events (message_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ig_online_message_events_ig_idx ON public.ig_online_message_events (lower(instagram_username), event);

GRANT ALL ON public.ig_online_sessions TO service_role;
GRANT ALL ON public.ig_online_events TO service_role;
GRANT ALL ON public.ig_online_messages TO service_role;
GRANT ALL ON public.ig_online_message_events TO service_role;

ALTER TABLE public.ig_online_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_online_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_online_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_online_message_events ENABLE ROW LEVEL SECURITY;
