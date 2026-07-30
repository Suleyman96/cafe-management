-- Close a cross-tenant data leak on the anonymous dine-in read path.
--
-- Background
-- ----------
-- `get_active_order_for_table(p_table_id)` is SECURITY DEFINER, granted to
-- `anon`, and validated the caller only with an EXISTENCE check
-- (`SELECT 1 FROM tables WHERE id = p_table_id`) — see
-- 20260418000001_fix_security_issues.sql. The header there claimed "an
-- attacker would need to know a valid table_id", but table ids are globally
-- enumerable: the public anon key can `SELECT id, tenant_id, table_number
-- FROM tables` (the `anon_read_tables USING (true)` policy exposes the
-- non-qr_code columns). So any anonymous internet user could iterate table
-- ids and pull every tenant's live order — totals, item lines, discounts,
-- customer_notes, and staff-only `internal_notes`.
--
-- This is the same bug class fixed for direct `orders` SELECT in
-- 20260517000003 (leaky `_scoped` policies dropped), but the RPC path was
-- left open.
--
-- Fix
-- ---
-- Treat the table's `qr_code` (a per-table secret the customer obtains only
-- by scanning the physical QR) as the capability, exactly like
-- `set_table_context` (20260507000006) and `get_delivery_order`
-- (delivery_access_token). `get_active_order_for_table` now REQUIRES the
-- `qr_token` and verifies it against the table (matching qr_code, not
-- revoked, not expired) before returning anything. table_id alone is no
-- longer sufficient. An invalid/absent token yields NULL — no oracle that
-- distinguishes "wrong token" from "no active order".
--
-- The signature changes (adds p_qr_token), so the old 1-arg function is
-- dropped and recreated; customer-web is updated to present the token
-- (persisted client-side per table, mirroring the delivery token flow).
--
-- Also: `get_waiter_calls_for_table` has the identical anon existence-only
-- pattern and grant, but has NO client caller anywhere (only referenced in
-- generated types). Rather than thread a token into dead code, we REVOKE
-- anon EXECUTE outright — closing the same leak with zero client impact.
--
-- Constraint relaxation? No — this tightens a security-relevant path. No
-- rollback file (the reverse would re-open the leak).

-- ── 1. Rebind get_active_order_for_table to the qr_token capability ──

DROP FUNCTION IF EXISTS public.get_active_order_for_table(uuid);

CREATE FUNCTION public.get_active_order_for_table(p_table_id uuid, p_qr_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Capability check: the caller must present the table's current QR secret.
  -- table_id alone is enumerable via the public anon key, so it is NOT a
  -- capability. Mirrors set_table_context()'s validation (matching qr_code,
  -- not revoked, not expired). No match → NULL (same shape as "no active
  -- order"), so this doesn't become an existence oracle.
  IF p_qr_token IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.tables
    WHERE id = p_table_id
      AND qr_code = p_qr_token
      AND qr_code_revoked_at IS NULL
      AND (qr_code_expires_at IS NULL OR qr_code_expires_at > now())
  ) THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'table_id', o.table_id,
    'tenant_id', o.tenant_id,
    'status', o.status,
    'order_type', o.order_type,
    'source', o.source,
    'subtotal', o.subtotal,
    'tax', o.tax,
    'total', o.total,
    'customer_notes', o.customer_notes,
    'internal_notes', o.internal_notes,
    'assigned_waiter_id', o.assigned_waiter_id,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'discount_type', o.discount_type,
    'discount_value', o.discount_value,
    'discount_amount', o.discount_amount,
    'table', jsonb_build_object(
      'table_number', t.table_number,
      'location', t.location
    ),
    'order_items', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', oi.id,
          'order_id', oi.order_id,
          'menu_item_id', oi.menu_item_id,
          'item_name', oi.item_name,
          'item_price', oi.item_price,
          'quantity', oi.quantity,
          'status', oi.status,
          'notes', oi.notes,
          'created_at', oi.created_at,
          'updated_at', oi.updated_at,
          'tenant_id', oi.tenant_id
        )
        ORDER BY oi.created_at ASC
      )
      FROM public.order_items oi
      WHERE oi.order_id = o.id),
      '[]'::jsonb
    )
  ) INTO result
  FROM public.orders o
  JOIN public.tables t ON t.id = o.table_id
  WHERE o.table_id = p_table_id
    AND o.status IN ('pending_approval', 'new', 'preparing', 'ready', 'served')
  ORDER BY o.created_at DESC
  LIMIT 1;

  RETURN result;
END;
$$;

ALTER FUNCTION public.get_active_order_for_table(uuid, text) OWNER TO postgres;

-- anon-only, same matrix as the other customer RPCs.
REVOKE EXECUTE ON FUNCTION public.get_active_order_for_table(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_active_order_for_table(uuid, text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.get_active_order_for_table(uuid, text) TO anon;

-- ── 2. Revoke anon on the dead waiter-calls RPC (no client caller) ──

REVOKE EXECUTE ON FUNCTION public.get_waiter_calls_for_table(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_waiter_calls_for_table(uuid, text) FROM PUBLIC;
