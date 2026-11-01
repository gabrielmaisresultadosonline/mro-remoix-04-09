-- MRO Ferramenta: arquivo ZIP da extensão enviado pelo /admin e baixado pelos
-- clientes (/mro-ferramenta) e pela própria extensão (atualização automática).
-- O arquivo fica no disco da VPS; aqui ficam o registro, data e hash.
-- Aditivo e idempotente.

CREATE TABLE IF NOT EXISTS public.mro_extension_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool TEXT NOT NULL DEFAULT 'mro',
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  sha256 TEXT NOT NULL,
  version TEXT,
  notes TEXT,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mro_extension_files_tool_idx
  ON public.mro_extension_files (tool, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS mro_extension_files_current_uq
  ON public.mro_extension_files (tool) WHERE is_current;
