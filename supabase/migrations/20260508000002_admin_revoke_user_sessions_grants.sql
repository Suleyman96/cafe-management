-- Grants for admin_revoke_user_sessions. See 20260508000001 for context.
-- Split from the function-body migration because the Supabase CLI's
-- pgx-based migration splitter cannot reliably parse a dollar-quoted
-- function definition followed by additional statements in the same
-- file (SQLSTATE 42601). Same pattern as
-- 20260505000003_refund_rpc_grants and 20260504000004_atomic_stock_adjust_grants.

REVOKE ALL ON FUNCTION public.admin_revoke_user_sessions(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_revoke_user_sessions(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_user_sessions(UUID) TO service_role;

COMMENT ON FUNCTION public.admin_revoke_user_sessions(UUID) IS
  'Revoke all refresh tokens and delete sessions for the given auth.users.id. Service-role only — caller must have already authorized via verifyAdmin and resolved the target staff''s auth_user_id under their own tenant_id.';
