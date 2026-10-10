ALTER TABLE IF EXISTS public.ferramentamropromo_settings ADD COLUMN IF NOT EXISTS player_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
