-- Produto do dashboard pode ficar fora de venda (só quem já tem acesso vê). Aditivo, idempotente.
ALTER TABLE public.hub_products ADD COLUMN IF NOT EXISTS sale_enabled BOOLEAN NOT NULL DEFAULT true;
