-- Rollback for 20260507000003_table_qr_rotation.sql.
--
-- Drops the three new columns and restores the baseline body of
-- `set_table_context` (English-prose error message, no expiry/revoked
-- checks). The columns being NULL on every existing row means dropping
-- them is non-destructive in practice, but we still gate the rollback
-- behind explicit operator confirmation if any tenant has populated
-- expires_at / revoked_at via the admin rotation endpoint.

BEGIN;

-- Restore baseline `set_table_context` body verbatim.
CREATE OR REPLACE FUNCTION public.set_table_context(qr_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_table_id  uuid;
  v_tenant_id uuid;
BEGIN
  SELECT id, tenant_id INTO v_table_id, v_tenant_id
    FROM public.tables WHERE qr_code = qr_token;

  IF v_table_id IS NULL THEN
    RAISE EXCEPTION 'Invalid QR code';
  END IF;

  PERFORM set_config('app.qr_token', qr_token, true);
  PERFORM set_config('app.current_table_id', v_table_id::text, true);
  PERFORM set_config('app.current_tenant_id', v_tenant_id::text, true);
END;
$$;

ALTER FUNCTION public.set_table_context(text) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.set_table_context(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_table_context(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_table_context(text) TO anon;

ALTER TABLE public.tables
  DROP COLUMN IF EXISTS qr_code_revoked_at,
  DROP COLUMN IF EXISTS qr_code_expires_at,
  DROP COLUMN IF EXISTS qr_code_rotated_at;

COMMIT;
