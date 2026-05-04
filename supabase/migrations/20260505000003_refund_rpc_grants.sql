-- Grants for create_refund_with_audit. See 20260505000002 for context.
-- Split from the function-body migration because the Supabase CLI's
-- pgx-based migration splitter cannot reliably parse a dollar-quoted
-- function definition followed by additional statements in the same
-- file (SQLSTATE 42601 "cannot insert multiple commands into a prepared
-- statement"). Same pattern as 20260504000004_atomic_stock_adjust_grants.

REVOKE ALL ON FUNCTION public.create_refund_with_audit(
  UUID, UUID, NUMERIC, TEXT, TEXT, UUID, UUID[], TEXT, UUID
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.create_refund_with_audit(
  UUID, UUID, NUMERIC, TEXT, TEXT, UUID, UUID[], TEXT, UUID
) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_refund_with_audit(
  UUID, UUID, NUMERIC, TEXT, TEXT, UUID, UUID[], TEXT, UUID
) TO service_role;

COMMENT ON FUNCTION public.create_refund_with_audit(
  UUID, UUID, NUMERIC, TEXT, TEXT, UUID, UUID[], TEXT, UUID
) IS 'Atomic refund + audit insert. Locks the parent order row and runs the dedupe lookup, refund INSERT, and audit-row trigger in a single transaction. Service-role only — caller must have already authorized via verifyAdmin and pass the verified tenant_id.';
