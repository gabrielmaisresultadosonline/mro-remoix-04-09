-- Referência inicial única por perfil do Instagram, compartilhada entre
-- /instagram/painel e /admin → IG Onlines → Métricas.
-- initial_* é gravado uma única vez (primeira leitura válida: extensão ou print)
-- e nunca é sobrescrito; current_* guarda a última leitura recebida.
-- Aditivo e idempotente.

CREATE TABLE IF NOT EXISTS public.ig_profile_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_username TEXT NOT NULL,
  initial_followers INTEGER,
  initial_following INTEGER,
  initial_posts INTEGER,
  initial_source TEXT,
  initial_captured_at TIMESTAMPTZ,
  current_followers INTEGER,
  current_following INTEGER,
  current_posts INTEGER,
  current_source TEXT,
  current_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ig_profile_baselines_ig_uq
  ON public.ig_profile_baselines (lower(instagram_username));

GRANT ALL ON public.ig_profile_baselines TO service_role;
ALTER TABLE public.ig_profile_baselines ENABLE ROW LEVEL SECURITY;
