-- Preserve all existing gallery rows/files; old API versions also see infinity as unexpired.
ALTER TABLE public.ig_online_gallery ALTER COLUMN expires_at SET DEFAULT 'infinity'::timestamptz;
UPDATE public.ig_online_gallery SET expires_at = 'infinity'::timestamptz WHERE expires_at IS DISTINCT FROM 'infinity'::timestamptz;
COMMENT ON COLUMN public.ig_online_gallery.expires_at IS 'Deprecated expiration: images are retained until explicit administrator deletion.';