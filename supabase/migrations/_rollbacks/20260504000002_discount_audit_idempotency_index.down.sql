-- Rollback for 20260504000002_discount_audit_idempotency_index.sql.
--
-- Drops the partial unique index. Note: the forward migration's pre-build
-- dedupe (DELETE rn > 1) is destructive and cannot be reversed — duplicate
-- audit rows that existed before the migration are gone. That is acceptable
-- because they represented the very corruption this constraint exists to
-- prevent.

DROP INDEX IF EXISTS public.uq_financial_audit_discount_client_request;
