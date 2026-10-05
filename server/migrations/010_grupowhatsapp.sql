-- Página /grupowhatsapp: leads do quiz e link do grupo (aditivo, idempotente).
CREATE TABLE IF NOT EXISTS public.grupowhatsapp_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  tem_computador BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.grupowhatsapp_leads ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.grupowhatsapp_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_link TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.grupowhatsapp_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON public.grupowhatsapp_leads TO service_role;
    GRANT ALL ON public.grupowhatsapp_settings TO service_role;
  END IF;
END $$;
