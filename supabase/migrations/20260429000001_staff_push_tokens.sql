-- ============================================================
-- C4. Normalize push tokens into staff_push_tokens
--
-- Move from a denormalized `staff.push_token` column to a per-
-- device `staff_push_tokens` table. The denormalized layout
-- could not represent multiple devices per staff and made cross-
-- tenant token reassignment (when a device is handed off to a
-- different tenant's user) racy.
--
-- Global UNIQUE on `expo_token` lets the register route DELETE
-- any prior owner of the same token before INSERTing the new
-- (tenant_id, staff_id, expo_token) row, so a notification can
-- never be sent to a device whose user has since logged into a
-- different tenant.
--
-- NOTE: Indexes are plain CREATE INDEX (not CONCURRENTLY)
-- because Supabase CLI's pipelined `db reset` rejects CONCURRENTLY.
-- See the equivalent note in 20260428000002_idempotency_keys.sql.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.staff_push_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_id    uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  expo_token  text NOT NULL,
  platform    text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_push_tokens_expo_token_uq
  ON public.staff_push_tokens (expo_token);

CREATE INDEX IF NOT EXISTS staff_push_tokens_staff_idx
  ON public.staff_push_tokens (staff_id);

CREATE INDEX IF NOT EXISTS staff_push_tokens_tenant_idx
  ON public.staff_push_tokens (tenant_id);

-- Migrate existing denormalized tokens. Each staff row with a
-- non-null push_token becomes one staff_push_tokens row.
INSERT INTO public.staff_push_tokens (tenant_id, staff_id, expo_token, last_seen_at)
SELECT s.tenant_id, s.id, s.push_token, COALESCE(s.last_login_at, now())
FROM public.staff s
WHERE s.push_token IS NOT NULL
ON CONFLICT (expo_token) DO NOTHING;

-- Drop the legacy column. Any remaining client (server-side
-- dispatcher, admin UI) must read via the new table.
ALTER TABLE public.staff DROP COLUMN IF EXISTS push_token;

-- RLS: staff can read/write their own tokens; service role
-- (used by /api/v1/push-tokens/* via getSupabaseAdmin) bypasses.
ALTER TABLE public.staff_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_push_tokens_self_select
  ON public.staff_push_tokens
  FOR SELECT
  TO authenticated
  USING (staff_id = (
    SELECT id FROM public.staff WHERE auth_user_id = auth.uid() LIMIT 1
  ));

CREATE POLICY staff_push_tokens_self_delete
  ON public.staff_push_tokens
  FOR DELETE
  TO authenticated
  USING (staff_id = (
    SELECT id FROM public.staff WHERE auth_user_id = auth.uid() LIMIT 1
  ));

-- Insert/update is server-route only (admin client). No policy
-- granted to authenticated role for INSERT/UPDATE so a direct
-- client cannot register a token under another staff_id.

COMMENT ON TABLE public.staff_push_tokens IS
  'Per-device Expo push tokens. expo_token is globally unique so re-registering a device under a new tenant evicts the prior owner.';
COMMENT ON COLUMN public.staff_push_tokens.expo_token IS
  'Expo push token (ExponentPushToken[...]). Globally unique.';
