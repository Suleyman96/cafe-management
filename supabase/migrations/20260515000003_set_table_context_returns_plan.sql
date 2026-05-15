-- ============================================================
-- Fix customer-web plan-resolution bug.
--
-- Empirical finding: customer-web's table landing was calling
-- `set_table_context(qr_token)` then immediately calling
-- `get_tenant_plan_from_context()`. The second call ALWAYS returned
-- NULL because:
--
--   - `set_table_context` binds session vars with `set_config(..., true)`
--     (transaction-local).
--   - PostgREST wraps each HTTP RPC in its own transaction.
--   - By the time the second call ran, the session var was gone.
--   - The function gracefully degraded to NULL (current_setting with
--     missing_ok=true returns NULL on missing → NULL::UUID is NULL →
--     no rows matched → function returned NULL), so no error reached
--     Sentry.
--
-- Customer-side symptom: table-landing.tsx renders the
-- `tenantPlan === null` branch (an empty 48px placeholder) instead
-- of the "Browse Menu" CTA. The bug was invisible because the empty
-- div doesn't trigger any error path.
--
-- Fix: roll the plan lookup into `set_table_context` itself. One
-- HTTP call, one transaction, no session-var-persistence assumption.
--
-- Signature change:
--   was:  set_table_context(qr_token text) RETURNS uuid
--   now:  set_table_context(qr_token text) RETURNS jsonb
--         (shape: { "tenant_id": <uuid>, "plan": <text> })
--
-- The only TS caller is `apps/customer-web/src/lib/supabase.ts`
-- which this PR updates in the same commit. Other clients (if any)
-- would need to migrate to the new shape — but the function is
-- granted to `anon` only and the codebase grep shows no other
-- callers.
--
-- Also: harden the orphan `get_tenant_plan_from_context()` with
-- `NULLIF` so a future caller that happens to set the session var
-- to an empty string (vs NULL) doesn't trip a `''::UUID` error.
-- It's belt-and-braces — empirically the function already returns
-- NULL gracefully — but the cast is cheap insurance.
-- ============================================================

DROP FUNCTION IF EXISTS public.set_table_context(text);

CREATE FUNCTION public.set_table_context(qr_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_table_id   uuid;
  v_tenant_id  uuid;
  v_plan       text;
  v_revoked_at timestamptz;
  v_expires_at timestamptz;
BEGIN
  SELECT id, tenant_id, qr_code_revoked_at, qr_code_expires_at
    INTO v_table_id, v_tenant_id, v_revoked_at, v_expires_at
    FROM public.tables
   WHERE qr_code = qr_token;

  IF v_table_id IS NULL THEN
    RAISE EXCEPTION 'invalid_qr_token';
  END IF;

  IF v_revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'qr_token_revoked';
  END IF;

  IF v_expires_at IS NOT NULL AND v_expires_at <= now() THEN
    RAISE EXCEPTION 'qr_token_expired';
  END IF;

  PERFORM set_config('app.qr_token', qr_token, true);
  PERFORM set_config('app.current_table_id', v_table_id::text, true);
  PERFORM set_config('app.current_tenant_id', v_tenant_id::text, true);

  -- Plan lookup happens in the SAME transaction so it's safe; the
  -- old `get_tenant_plan_from_context()` RPC depended on the session
  -- var surviving a separate HTTP roundtrip and silently always
  -- returned NULL.
  SELECT plan INTO v_plan FROM public.tenants WHERE id = v_tenant_id;

  RETURN jsonb_build_object('tenant_id', v_tenant_id, 'plan', v_plan);
END;
$$;

ALTER FUNCTION public.set_table_context(text) OWNER TO postgres;

-- Same grant matrix as the previous version: anon-only.
REVOKE EXECUTE ON FUNCTION public.set_table_context(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_table_context(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_table_context(text) TO anon;

COMMENT ON FUNCTION public.set_table_context(text) IS
  'Binds the customer QR session and returns { tenant_id, plan } in one call. The plan field replaces the broken `get_tenant_plan_from_context()` pattern (separate-transaction session vars).';

-- ── Defense-in-depth: harden the orphan get_tenant_plan_from_context ─
--
-- The function is no longer called from customer-web after this PR
-- (table-landing.tsx now uses the plan returned by set_table_context).
-- It's still granted to anon, so we keep it around for back-compat /
-- any unknown callers, but with NULLIF so it doesn't throw if the
-- session var is set to '' rather than NULL.
--
-- Once we're certain there are no remaining callers (after a grace
-- period in prod), this function can be dropped in a follow-up
-- migration.
CREATE OR REPLACE FUNCTION public.get_tenant_plan_from_context()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT t.plan FROM public.tenants t
   WHERE t.id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$;
