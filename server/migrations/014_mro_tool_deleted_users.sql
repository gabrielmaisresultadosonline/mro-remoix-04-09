-- Lixeira da MRO Ferramenta: cópia completa do usuário excluído (dados, contas e histórico)
-- para permitir restauração pelo /admin. Aditiva e idempotente.
CREATE TABLE IF NOT EXISTS public.mro_tool_deleted_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_user_id uuid NOT NULL,
  username text NOT NULL,
  email text,
  user_data jsonb NOT NULL,
  accounts jsonb NOT NULL DEFAULT '[]'::jsonb,
  logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  restored_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_mro_tool_deleted_users_deleted_at ON public.mro_tool_deleted_users(deleted_at DESC);
GRANT ALL ON public.mro_tool_deleted_users TO service_role;
ALTER TABLE public.mro_tool_deleted_users ENABLE ROW LEVEL SECURITY;
