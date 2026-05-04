-- Rollback for 20260505000004_discount_rpc.sql + 20260505000005_discount_rpc_grants.sql.
-- Drops apply_discount_with_audit. The discount-service code path that
-- called this RPC must be reverted in lockstep.

DROP FUNCTION IF EXISTS public.apply_discount_with_audit(
  UUID, UUID, TEXT, NUMERIC, TEXT, UUID, UUID
);
