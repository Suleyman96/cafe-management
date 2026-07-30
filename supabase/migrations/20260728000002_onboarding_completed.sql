-- First-run onboarding state for the getting-started checklist.
--
-- A freshly self-provisioned tenant (20260728000001) lands with the default
-- cafe name and no menu items / tables. The staff-web /onboarding page shows a
-- getting-started checklist until this is set; the post-login landing routes
-- owners there while it's NULL.
ALTER TABLE public.cafe_settings
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

COMMENT ON COLUMN public.cafe_settings.onboarding_completed_at IS
  'Set when the owner finishes/dismisses the first-run getting-started checklist. NULL = still onboarding (landing routes to /onboarding).';
