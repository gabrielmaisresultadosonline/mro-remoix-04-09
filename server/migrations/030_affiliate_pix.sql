-- Chaves Pix privadas: somente o próprio afiliado e administração via funções.
-- Aditivo: preserva afiliados, pedidos e arquivos existentes da VPS.
CREATE TABLE IF NOT EXISTS public.affiliate_pix (
  affiliate_id text PRIMARY KEY,
  owner_username text NOT NULL,
  pix_key text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.affiliate_pix TO service_role;
ALTER TABLE public.affiliate_pix ENABLE ROW LEVEL SECURITY;