-- Configuração exclusiva do Pixel da página Cadastro Rend, preservando registros.
ALTER TABLE public.cadastrorend_settings
  ADD COLUMN IF NOT EXISTS pixel_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pixel_enabled boolean NOT NULL DEFAULT false;