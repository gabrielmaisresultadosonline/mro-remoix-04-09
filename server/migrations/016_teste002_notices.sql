-- Teste grátis /teste002: Instagram cadastrado pela extensão, acessos e avisos diários. Aditivo e idempotente.
ALTER TABLE public.teste002_users ALTER COLUMN instagram_username DROP NOT NULL;
ALTER TABLE public.teste002_users ALTER COLUMN expires_at DROP NOT NULL;
ALTER TABLE public.teste002_users ALTER COLUMN expires_at DROP DEFAULT;
ALTER TABLE public.teste002_users ADD COLUMN IF NOT EXISTS last_extension_access TIMESTAMPTZ;
ALTER TABLE public.teste002_users ADD COLUMN IF NOT EXISTS last_browser_access TIMESTAMPTZ;
ALTER TABLE public.teste002_users ADD COLUMN IF NOT EXISTS last_browser_url TEXT;
ALTER TABLE public.teste002_users ADD COLUMN IF NOT EXISTS extension_version TEXT;

CREATE TABLE IF NOT EXISTS public.teste002_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  youtube_url TEXT NOT NULL DEFAULT '',
  buttons JSONB NOT NULL DEFAULT '[]'::jsonb,
  lock_seconds INTEGER NOT NULL DEFAULT 0,
  schedule_times TEXT[] NOT NULL DEFAULT ARRAY['09:00']::text[],
  repeat_daily BOOLEAN NOT NULL DEFAULT true,
  target TEXT NOT NULL DEFAULT 'all',
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teste002_notices ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.teste002_notice_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id UUID NOT NULL REFERENCES public.teste002_notices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.teste002_users(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  slot_key TEXT NOT NULL DEFAULT '',
  button_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS teste002_notice_events_notice_idx ON public.teste002_notice_events (notice_id, user_id, event);
CREATE INDEX IF NOT EXISTS teste002_notice_events_user_idx ON public.teste002_notice_events (user_id);
ALTER TABLE public.teste002_notice_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON public.teste002_notices TO service_role;
    GRANT ALL ON public.teste002_notice_events TO service_role;
  END IF;
END $$;
