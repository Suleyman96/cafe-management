-- ============================================================
-- H2. QR-code rotation + revocation + expiry on `tables`.
--
-- Pre-PR4 attack: photograph any restaurant's table-QR sticker once
-- and the qr_code UUID is valid forever. There's no way for an admin
-- to invalidate a leaked or stolen code, no way to recover from a
-- printed-but-public QR (e.g. a sticker an ex-employee photographed),
-- and the same code stays alive across the lifetime of the table row.
-- A long-tail attacker holds latent kitchen-flood / order-spam
-- capability for every restaurant they've ever visited.
--
-- This migration adds three columns and reworks `set_table_context`
-- so:
--   - `qr_code_revoked_at`  — admin-set "this code is dead" timestamp
--   - `qr_code_expires_at`  — auto-expire timestamp (NULL = no expiry)
--   - `qr_code_rotated_at`  — last rotation timestamp (audit trail)
--
-- The RPC raises sentinel-shaped messages (`qr_token_revoked`,
-- `qr_token_expired`, plus the existing `invalid_qr_token` for
-- not-found) so client error handlers can distinguish causes for
-- analytics. The customer-web UI surfaces a single user-facing
-- message ("ask staff for a new QR code") regardless of the specific
-- reason — translating three near-identical sentinels into 20 locales
-- is deferred until / unless we want to differentiate the UX.
--
-- Why no enforcement-toggle feature flag. Defaults are NULL on every
-- existing row. Customers scanning unrotated QRs continue to work
-- exactly as before; the new checks short-circuit on NULL. Enforcement
-- only kicks in for tables an admin has explicitly rotated or expired.
-- The "blast radius" of the deploy is therefore zero — nothing
-- changes for any customer until an operator opts in by clicking
-- "Rotate QR" on a table. A separate follow-up can introduce a
-- per-tenant default expiry once we're confident the rotation flow
-- behaves well in production.
--
-- Type-gen: this migration adds columns to `tables`. Run
-- `pnpm db:types:generate` and commit the regenerated
-- `packages/database/src/types/generated.ts` in the same PR (CI
-- enforces).
-- ============================================================

BEGIN;

-- ── 1. New columns on tables ──────────────────────────────────────

ALTER TABLE public.tables
  ADD COLUMN IF NOT EXISTS qr_code_revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS qr_code_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS qr_code_rotated_at timestamptz;

COMMENT ON COLUMN public.tables.qr_code_revoked_at IS
  'Set by admin "Rotate QR" or "Revoke QR" actions. set_table_context() refuses to bind context for a table whose qr_code_revoked_at is set, even if the qr_code value matches. Rotation clears this column to re-enable the new code.';

COMMENT ON COLUMN public.tables.qr_code_expires_at IS
  'Optional auto-expiry timestamp. NULL means no expiry — current default for back-compat with pre-PR4 tables. set_table_context() refuses tokens where expires_at <= now().';

COMMENT ON COLUMN public.tables.qr_code_rotated_at IS
  'Last rotation timestamp (audit trail). Updated by the admin rotation endpoint, not by set_table_context().';

-- ── 2. Update set_table_context to enforce ────────────────────────
--
-- Three failure modes, each raised with a distinct sentinel-shaped
-- message so error handlers / Sentry can break down causes. The
-- default Postgres ERRCODE 'P0001' is fine — handleSupabaseError
-- doesn't distinguish on code, only on message. The existing baseline
-- function raised English prose 'Invalid QR code'; this is a
-- soft-breaking change for any caller that pattern-matched that
-- string (none in-tree).

CREATE OR REPLACE FUNCTION public.set_table_context(qr_token text)
RETURNS void
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
END;
$$;

ALTER FUNCTION public.set_table_context(text) OWNER TO postgres;

-- Re-grant per the C3/H5 hardening from migration 20260430000002:
-- anon-only. Authenticated staff resolve tenant from their staff row,
-- not from this RPC.
REVOKE EXECUTE ON FUNCTION public.set_table_context(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_table_context(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_table_context(text) TO anon;

COMMIT;
