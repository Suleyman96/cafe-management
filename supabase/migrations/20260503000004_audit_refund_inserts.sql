-- Refund audit trigger.
-- Refunds were previously invisible in financial_audit_log, leaving no detective
-- control for the highest-risk financial operation. This migration:
--   1. Extends financial_audit_log with staff_id (uuid) and details (jsonb) so the
--      audit row can capture the responsible staff and refund-specific context
--      that doesn't fit the existing order-totals delta shape.
--   2. Adds an AFTER INSERT trigger on public.refunds that writes one audit row
--      per refund with action='refund'.
--   3. Backfills audit rows for refunds that existed before the trigger.

BEGIN;

-- ========================================
-- 1. Extend audit log with refund-shaped fields
-- ========================================

ALTER TABLE public.financial_audit_log
  ADD COLUMN IF NOT EXISTS staff_id UUID,
  ADD COLUMN IF NOT EXISTS details JSONB;

CREATE INDEX IF NOT EXISTS idx_financial_audit_staff
  ON public.financial_audit_log (staff_id, created_at DESC);

-- ========================================
-- 2. Trigger function
-- ========================================

CREATE OR REPLACE FUNCTION public.log_refund_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.financial_audit_log (
    tenant_id, order_id, staff_id, action, details, triggered_by, created_at
  ) VALUES (
    NEW.tenant_id,
    NEW.order_id,
    NEW.processed_by,
    'refund',
    jsonb_build_object(
      'refund_id', NEW.id,
      'amount', NEW.amount,
      'reason', NEW.reason,
      'refund_method', NEW.refund_method
    ),
    'trigger:log_refund_on_insert',
    NOW()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_refund_on_insert ON public.refunds;

CREATE TRIGGER trg_log_refund_on_insert
AFTER INSERT ON public.refunds
FOR EACH ROW EXECUTE FUNCTION public.log_refund_on_insert();

-- ========================================
-- 3. Backfill existing refunds
-- ========================================

INSERT INTO public.financial_audit_log (
  tenant_id, order_id, staff_id, action, details, triggered_by, created_at
)
SELECT
  r.tenant_id,
  r.order_id,
  r.processed_by,
  'refund',
  jsonb_build_object(
    'refund_id', r.id,
    'amount', r.amount,
    'reason', r.reason,
    'refund_method', r.refund_method,
    'backfilled', true
  ),
  'backfill:20260503000004_audit_refund_inserts',
  r.created_at
FROM public.refunds r
WHERE NOT EXISTS (
  SELECT 1
  FROM public.financial_audit_log l
  WHERE l.action = 'refund'
    AND (l.details->>'refund_id')::uuid = r.id
);

COMMIT;
