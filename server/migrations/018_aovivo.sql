-- Ao Vivo MRO: transmissões contínuas (loop de vídeos) para o Instagram via RTMPS.
-- Aditivo e idempotente. Acesso apenas pelo backend (service_role / adminQuery).

CREATE TABLE IF NOT EXISTS public.aovivo_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL DEFAULT 'user' CHECK (owner_type IN ('admin','user')),
  user_id UUID,
  owner_label TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT 'Minha live',
  rtmp_url TEXT NOT NULL DEFAULT '',
  stream_key TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'stopped' CHECK (status IN ('stopped','running','error')),
  started_at TIMESTAMPTZ,
  total_seconds BIGINT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS aovivo_streams_user_idx ON public.aovivo_streams(user_id);
CREATE INDEX IF NOT EXISTS aovivo_streams_status_idx ON public.aovivo_streams(status);

CREATE TABLE IF NOT EXISTS public.aovivo_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES public.aovivo_streams(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aovivo_videos_stream_idx ON public.aovivo_videos(stream_id);

CREATE TABLE IF NOT EXISTS public.aovivo_limits (
  user_id UUID PRIMARY KEY,
  max_streams INTEGER NOT NULL DEFAULT 1 CHECK (max_streams BETWEEN 0 AND 50),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON public.aovivo_streams, public.aovivo_videos, public.aovivo_limits TO service_role;
  END IF;
END $$;

ALTER TABLE public.aovivo_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aovivo_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aovivo_limits ENABLE ROW LEVEL SECURITY;
