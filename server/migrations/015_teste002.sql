-- Teste grátis /teste002: cadastros de 1 dia (1 Instagram, só Seguir/Curtir/Boas-vindas). Aditivo e idempotente.
CREATE TABLE IF NOT EXISTS public.teste002_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  instagram_username TEXT NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 day'),
  last_access TIMESTAMPTZ,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS teste002_users_instagram_key ON public.teste002_users (lower(instagram_username));
CREATE UNIQUE INDEX IF NOT EXISTS teste002_users_username_key ON public.teste002_users (lower(username));
CREATE INDEX IF NOT EXISTS teste002_users_created_idx ON public.teste002_users (created_at DESC);
ALTER TABLE public.teste002_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.teste002_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_url TEXT NOT NULL DEFAULT '',
  install_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teste002_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON public.teste002_users TO service_role;
    GRANT ALL ON public.teste002_settings TO service_role;
  END IF;
END $$;
