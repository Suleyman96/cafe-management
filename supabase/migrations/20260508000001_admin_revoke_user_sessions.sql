-- ============================================================
-- Pre-release C3: revoke-all-sessions admin RPC.
-- ============================================================
--
-- Goal: when a staff member is deactivated (`staff.is_active = false`),
-- their existing refresh tokens must stop being usable. Without this, the
-- mobile / web client's `autoRefreshToken: true` mints fresh access
-- tokens for ≤ access_token_ttl after the flip, and the
-- `is_active_staff` JWT claim only changes on the *next* refresh.
-- A fired employee with an unexpired refresh token retains silent
-- access for that window.
--
-- Why this lives in a SECURITY DEFINER function (and not raw SQL from
-- the route): `auth.refresh_tokens` and `auth.sessions` are owned by
-- the GoTrue (Supabase Auth) service. Direct table writes from JS
-- require service-role + the `auth` schema cast (`db.schema('auth')`),
-- which is documented but type-unsafe and brittle to GoTrue schema
-- changes. A SECURITY DEFINER function in `public` localizes the
-- coupling to one auditable place; a future schema rename only
-- requires a function-body migration, not a JS callsite update.
--
-- Why not `auth.admin.signOut(jwt, scope)` from the route: that admin
-- API takes a *JWT*, not a userId. The deactivation path doesn't have
-- the target user's JWT (only their staff_id → auth_user_id), so we
-- need a userId-keyed equivalent. The self-service password-change
-- flow does NOT call this RPC — it uses the client-side
-- `supabase.auth.signOut({ scope: 'others' })` which is JWT-keyed
-- (the user has their own JWT) and keeps their current session alive.
--
-- Authorization: this RPC trusts its `p_user_id` argument because the
-- only legitimate caller is `/api/v1/staff/revoke-sessions` after
-- `verifyAdmin`. Service-role only. The function does NOT scope by
-- tenant — the route layer enforces tenant isolation by resolving the
-- staffId → auth_user_id lookup with a `tenant_id` filter.
--
-- What it does:
--   1. Marks all unrevoked rows in `auth.refresh_tokens` for the user
--      as revoked. Subsequent refresh attempts return 401.
--   2. Deletes corresponding `auth.sessions` rows so server-side
--      session-validation hooks (if any) reject immediately.
--
-- What it does NOT do: invalidate already-issued *access* tokens.
-- Those expire on their own TTL (~1h default). The custom_access_token
-- hook (migration 20260423000006) already strips `is_active_staff:true`
-- on the next refresh, and `verifyStaff` rejects `is_active_staff:false`
-- — so combined with this RPC, the worst-case access-retention
-- window after deactivation is bounded by access_token_ttl, regardless
-- of refresh_token_ttl.
--
-- Note on file split: same pattern as `20260505000002_refund_rpc.sql`
-- — function body and grants live in separate migration files because
-- the Supabase CLI's pgx splitter can't handle dollar-quoted bodies
-- followed by ancillary statements in one file.

CREATE OR REPLACE FUNCTION public.admin_revoke_user_sessions(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_revoked_count INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE auth.refresh_tokens
  SET revoked = true, updated_at = now()
  WHERE user_id = p_user_id::TEXT
    AND revoked = false;
  GET DIAGNOSTICS v_revoked_count = ROW_COUNT;

  -- `auth.sessions` is the GoTrue session registry; deleting rows here
  -- prevents reuse of any session-bound flow (e.g. server-issued OAuth
  -- callbacks) that pivot off it. Refresh tokens above are the primary
  -- gate for our refresh-driven mobile/web clients.
  DELETE FROM auth.sessions WHERE user_id = p_user_id;

  RETURN v_revoked_count;
END;
$$;
