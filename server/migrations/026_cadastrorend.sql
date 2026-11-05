-- Página /cadastrorend: cadastros do quiz, visitas e link do grupo (aditivo, idempotente).
CREATE TABLE IF NOT EXISTS public.cadastrorend_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  tem_computador BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cadastrorend_leads ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.cadastrorend_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_link TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cadastrorend_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.cadastrorend_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cadastrorend_visits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON public.cadastrorend_leads TO service_role;
    GRANT ALL ON public.cadastrorend_settings TO service_role;
    GRANT ALL ON public.cadastrorend_visits TO service_role;
  END IF;
END $$;
