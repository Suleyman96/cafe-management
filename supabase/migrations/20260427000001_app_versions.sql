-- ============================================================
-- Force-update gate: app_versions table + RPC
-- Lets backend lock out incompatible mobile binaries when a
-- non-backwards-compatible migration ships.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_versions (
  platform TEXT PRIMARY KEY CHECK (platform IN ('ios', 'android')),
  min_supported_version TEXT NOT NULL,
  latest_version TEXT NOT NULL,
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  maintenance_message TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.app_versions (platform, min_supported_version, latest_version)
VALUES ('ios', '1.0.0', '1.0.0'), ('android', '1.0.0', '1.0.0')
ON CONFLICT (platform) DO NOTHING;

ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can read app_versions" ON public.app_versions;
CREATE POLICY "anyone can read app_versions"
  ON public.app_versions FOR SELECT
  USING (true);

-- RPC consumed by the mobile version gate. SECURITY DEFINER so anonymous
-- callers can read the gate before authenticating.
CREATE OR REPLACE FUNCTION public.get_app_version(p_platform TEXT)
RETURNS TABLE(
  min_supported_version TEXT,
  latest_version TEXT,
  maintenance_mode BOOLEAN,
  maintenance_message TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    av.min_supported_version,
    av.latest_version,
    av.maintenance_mode,
    av.maintenance_message
  FROM public.app_versions av
  WHERE av.platform = p_platform;
$$;

GRANT EXECUTE ON FUNCTION public.get_app_version(TEXT) TO anon, authenticated;
