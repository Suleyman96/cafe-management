-- Rollback for 20260505000002_refund_rpc.sql + 20260505000003_refund_rpc_grants.sql.
-- Drops the create_refund_with_audit function. The refund-service code
-- path that called this RPC must be reverted in lockstep — without the
-- function the JS client will see "function does not exist" 5xx.

DROP FUNCTION IF EXISTS public.create_refund_with_audit(
  UUID, UUID, NUMERIC, TEXT, TEXT, UUID, UUID[], TEXT, UUID
);
