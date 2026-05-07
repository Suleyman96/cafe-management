-- ============================================================
-- L4. Stop anon from SELECT-ing the QR-code columns directly.
--
-- Pre-PR state:
--   `anon_read_tables` policy is `USING (true)`, plus
--   `GRANT ALL ON TABLE public.tables TO anon` covers every column.
--   That means `SELECT qr_code FROM tables` from the anon Supabase
--   key dumps every active QR code in the database — across every
--   tenant. PR #97 added rotation/revocation/expiry, which limits
--   the value of a leaked code, but a bulk scrape still hands an
--   attacker an instant snapshot of every tenant's currently-valid
--   codes. They can then race the rotation window to spam orders.
--
-- This migration closes the column-level read entirely:
--
--   1. Extend `set_table_context(qr_token text)` to RETURN the
--      bound `tenant_id`. The function already does the lookup as
--      SECURITY DEFINER (running as `postgres`), so it can keep
--      reading the qr_code column even after we revoke anon's
--      direct SELECT. Returning the tenant_id lets customer-web
--      bind the wrapper's tenant context without a second
--      `findByQrCode` round-trip.
--
--   2. REVOKE table-wide SELECT on public.tables from anon and
--      re-grant SELECT on the public-safe columns only. Postgres
--      treats column-level REVOKE as a no-op when a broader
--      table-level GRANT exists, so the only way to actually hide
--      the four qr_code* columns from anon is to revoke the table
--      grant first and re-grant column-by-column. Authenticated
--      and service_role keep their full GRANT ALL — admin UIs
--      need to read qr_code (rotation print/preview), and the
--      rotation service runs with service role.
--
--      The wrapper-level companion to this revoke lives in
--      `packages/api-client/src/wrapper/tables.ts`: findById /
--      findByTableNumber were narrowed to an explicit column list
--      that matches the new anon grant, so customer-web's
--      `select('*')`-style reads keep working under the tighter
--      grant.
--
-- Compatibility:
--   - The RPC's return type changes from `void` to `uuid`. Existing
--     callers that ignored the return value (table-landing.tsx)
--     continue to work. Customer-web's setTableContext() is
--     updated in the same PR to consume the new return.
--   - Authenticated staff still have full SELECT (including the
--     qr_code* columns). The admin rotation UI uses the service
--     role anyway, so its read path is doubly-unaffected.
--   - Regenerate `packages/database/src/types/generated.ts` after
--     applying so the RPC's new return type propagates to typed
--     callers. CI gates on `db:types:check`.
-- ============================================================

BEGIN;

-- ── 1. Replace set_table_context to RETURN tenant_id ───────────────
--
-- CREATE OR REPLACE FUNCTION cannot change the return type, so DROP
-- first. Grants and ownership are re-applied below.

DROP FUNCTION IF EXISTS public.set_table_context(text);

CREATE FUNCTION public.set_table_context(qr_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_table_id   uuid;
  v_tenant_id  uuid;
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

  RETURN v_tenant_id;
END;
$$;

ALTER FUNCTION public.set_table_context(text) OWNER TO postgres;

-- Same grant matrix as 20260430000002 / 20260507000003: anon-only.
-- Authenticated staff resolve tenant from their staff row, not from
-- this RPC.
REVOKE EXECUTE ON FUNCTION public.set_table_context(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_table_context(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_table_context(text) TO anon;

-- ── 2. Restrict anon SELECT on tables to non-qr columns ───────────
--
-- Drop the broad table SELECT, then re-grant column-by-column for
-- the public-safe columns only. The four qr_code* columns are now
-- inaccessible to anon — including in WHERE predicates, since
-- Postgres requires column-level SELECT for any reference, not just
-- output columns. (This is what prevents
-- `SELECT id FROM tables WHERE qr_code = '…'` from leaking via a
-- timing/exists oracle: the WHERE clause itself fails.)
--
-- INSERT/UPDATE/DELETE grants are left alone — RLS already blocks
-- anon writes, so the column-level read is the only meaningful
-- privilege. Keeping the write grants in place avoids breaking
-- the (currently empty) future-anon-write surface.

REVOKE SELECT ON public.tables FROM anon;

GRANT SELECT (
  id,
  tenant_id,
  table_number,
  capacity,
  location,
  status,
  current_session_id,
  occupied_at,
  is_active,
  notes,
  created_at,
  updated_at
) ON public.tables TO anon;

COMMIT;
