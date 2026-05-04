-- Migration: idempotency constraint for discount audit rows.
--
-- Root cause being fixed:
--   `applyDiscount` (apps/staff-web/src/lib/services/discount-service.ts) writes
--   one financial_audit_log row per discount apply with action='discount_applied'
--   and stamps `client_request_id` into the details JSONB so retries can be
--   short-circuited via a pre-INSERT lookup. That lookup is TOCTOU-prone:
--   two concurrent replays can both miss the lookup and both insert, producing
--   duplicate audit rows for a single client-originated mutation. The
--   discount UPDATE itself is idempotent on absolute values, so order state
--   is correct — but reconciliation tooling that counts audit rows over-counts
--   and the audit trail loses its 1:1 correspondence with intent.
--
-- Fix:
--   Partial unique index scoped to (tenant_id, action, client_request_id) for
--   discount_applied rows that carry a client_request_id. Postgres serializes
--   concurrent inserts on a unique index — one wins, the loser gets 23505
--   (unique_violation), which the service catches and treats as a successful
--   dedupe (same pattern as stock_movements' (tenant_id, client_request_id)
--   constraint, see lib/services/stock-service.ts).
--
--   The index is partial because:
--     - other actions (item_insert, item_update, item_delete, discount_change,
--       payment, refund) write to financial_audit_log with their own dedupe
--       schemes (refunds key on details->>'refund_id'); they should not
--       interact with this constraint.
--     - legacy discount_applied rows pre-dating client_request_id stamping
--       are excluded so they don't conflict with new rows.
--
-- NOTE on CONCURRENTLY:
--   The Supabase CLI runs migrations inside a pipelined transaction
--   (see `db reset`), and CREATE INDEX CONCURRENTLY is forbidden in a
--   transaction block. The brief AccessShareLock on financial_audit_log
--   during index build is acceptable in dev/CI. For production rollout
--   against a populated table, build the index manually outside any
--   transaction, e.g.:
--     CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
--       uq_financial_audit_discount_client_request
--     ON public.financial_audit_log
--       (tenant_id, action, ((details->>'client_request_id')))
--     WHERE action = 'discount_applied'
--       AND details ? 'client_request_id';
--   then verify it exists before merging this migration to the prod branch —
--   the IF NOT EXISTS guard makes the migration a no-op when the index has
--   already been built out-of-band.
--
-- Pre-existing duplicate handling:
--   If duplicate (tenant_id, action='discount_applied', client_request_id)
--   rows already exist, the index build will fail. We dedupe in-place first,
--   keeping the earliest row per group (lowest created_at, then lowest id).

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY tenant_id, action, (details->>'client_request_id')
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.financial_audit_log
  WHERE action = 'discount_applied'
    AND details ? 'client_request_id'
)
DELETE FROM public.financial_audit_log
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_audit_discount_client_request
  ON public.financial_audit_log (tenant_id, action, ((details->>'client_request_id')))
  WHERE action = 'discount_applied'
    AND details ? 'client_request_id';
