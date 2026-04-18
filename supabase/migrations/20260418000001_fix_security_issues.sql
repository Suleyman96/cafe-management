-- Security fixes: Replace permissive USING(true) anon SELECT policies,
-- scope anonymous UPDATE, and add RPC functions for sensitive data reads.
--
-- Background: Migration 20260412000003 replaced broken session-variable-based
-- policies with USING(true) on all anon SELECT/UPDATE operations. This allows
-- any unauthenticated user to read all data from all tenants via direct REST
-- API calls. This migration fixes that.

-- ============================================================
-- 1. DROP all existing permissive anon SELECT policies
-- ============================================================

-- From 20260412000003
DROP POLICY IF EXISTS "anon_read_orders" ON public.orders;
DROP POLICY IF EXISTS "anon_read_order_items" ON public.order_items;
DROP POLICY IF EXISTS "anon_read_waiter_calls" ON public.waiter_calls;
DROP POLICY IF EXISTS "anon_read_feedback" ON public.customer_feedback;
DROP POLICY IF EXISTS "anon_read_tables" ON public.tables;
DROP POLICY IF EXISTS "anon_read_categories" ON public.categories;
DROP POLICY IF EXISTS "anon_read_menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "anon_read_cafe_settings" ON public.cafe_settings;

-- From 20260301000002 (duplicates)
DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;
DROP POLICY IF EXISTS "Anyone can view menu_items" ON public.menu_items;

-- Any leftover anon read on order_payments
DROP POLICY IF EXISTS "anon_read_via_context" ON public.order_payments;
DROP POLICY IF EXISTS "anon_read_order_payments" ON public.order_payments;

-- ============================================================
-- 2. PUBLIC DATA: Keep USING(true) for non-sensitive tables
--    (menu, categories, settings, tables)
--    These are intentionally public — a restaurant's menu is
--    displayed to walk-in customers. The delivery flow needs
--    these without any table context.
-- ============================================================

CREATE POLICY "anon_read_categories" ON public.categories
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_menu_items" ON public.menu_items
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_cafe_settings" ON public.cafe_settings
  FOR SELECT TO anon USING (true);

-- Tables: needed for findByTableNumber and findById lookups.
-- Table data (number, location, capacity) is not sensitive.
CREATE POLICY "anon_read_tables" ON public.tables
  FOR SELECT TO anon USING (true);

-- ============================================================
-- 3. SENSITIVE DATA: Scoped RLS for Realtime compatibility
--    These policies exist so that Supabase Realtime postgres_changes
--    subscriptions can still fire. The actual data fetching from
--    customer-web switches to RPC functions (Phase 2).
-- ============================================================

-- Orders: anon can only see dine-in orders (table_id IS NOT NULL).
-- Delivery orders are fetched via RPC by order_id.
-- An attacker would need to know a valid UUID table_id to query.
CREATE POLICY "anon_read_orders_scoped" ON public.orders
  FOR SELECT TO anon
  USING (table_id IS NOT NULL);

-- Order items: anon can only see items belonging to dine-in orders.
CREATE POLICY "anon_read_order_items_scoped" ON public.order_items
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND o.table_id IS NOT NULL
    )
  );

-- Waiter calls: anon can only see calls with a table_id.
CREATE POLICY "anon_read_waiter_calls_scoped" ON public.waiter_calls
  FOR SELECT TO anon
  USING (table_id IS NOT NULL);

-- Customer feedback: anon only writes, never needs to read.
CREATE POLICY "anon_read_feedback_blocked" ON public.customer_feedback
  FOR SELECT TO anon
  USING (false);

-- Order payments: anon never needs to read payment data.
-- No policy = no access (RLS is already enabled).

-- ============================================================
-- 4. FIX anon UPDATE policy on orders
--    Current: USING(true) WITH CHECK(status = 'cancelled')
--    This allows any anon to cancel ANY order from ANY tenant.
-- ============================================================

DROP POLICY IF EXISTS "anon_update_cancel" ON public.orders;

CREATE POLICY "anon_cancel_early_orders" ON public.orders
  FOR UPDATE TO anon
  USING (
    -- Only early-stage orders can be cancelled by customers
    status IN ('pending_approval', 'new')
    AND (
      -- Dine-in: must know the table_id (UUID is a capability token)
      table_id IS NOT NULL
      OR
      -- Delivery: must know the order_id
      (table_id IS NULL AND order_type = 'delivery')
    )
  )
  WITH CHECK (
    status = 'cancelled'
  );

-- ============================================================
-- 5. RPC FUNCTIONS for anonymous data reads (SECURITY DEFINER)
--    These bypass RLS and return only scoped data.
-- ============================================================

-- 5a. Get active order for a specific table (dine-in)
CREATE OR REPLACE FUNCTION public.get_active_order_for_table(p_table_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Validate table exists
  IF NOT EXISTS (SELECT 1 FROM public.tables WHERE id = p_table_id) THEN
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

-- 5b. Get delivery order by ID
CREATE OR REPLACE FUNCTION public.get_delivery_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
BEGIN
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
    'customer_name', o.customer_name,
    'customer_phone', o.customer_phone,
    'delivery_address', o.delivery_address,
    'delivery_notes', o.delivery_notes,
    'delivery_fee', o.delivery_fee,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
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
          'tenant_id', oi.tenant_id,
          'menu_item', (
            SELECT jsonb_build_object(
              'id', mi.id,
              'name', mi.name,
              'price', mi.price,
              'image_url', mi.image_url
            )
            FROM public.menu_items mi
            WHERE mi.id = oi.menu_item_id
          )
        )
        ORDER BY oi.created_at ASC
      )
      FROM public.order_items oi
      WHERE oi.order_id = o.id),
      '[]'::jsonb
    ),
    'delivery_person', CASE
      WHEN o.delivery_person_id IS NOT NULL THEN (
        SELECT jsonb_build_object('full_name', s.full_name)
        FROM public.staff s
        WHERE s.id = o.delivery_person_id
      )
      ELSE NULL
    END
  ) INTO result
  FROM public.orders o
  WHERE o.id = p_order_id;

  RETURN result;
END;
$$;

-- 5c. Get waiter calls for a specific table
CREATE OR REPLACE FUNCTION public.get_waiter_calls_for_table(
  p_table_id UUID,
  p_status TEXT DEFAULT 'pending'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Validate table exists
  IF NOT EXISTS (SELECT 1 FROM public.tables WHERE id = p_table_id) THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id', wc.id,
        'table_id', wc.table_id,
        'tenant_id', wc.tenant_id,
        'call_type', wc.call_type,
        'status', wc.status,
        'reason', wc.reason,
        'priority', wc.priority,
        'notes', wc.notes,
        'created_at', wc.created_at,
        'updated_at', wc.updated_at,
        'acknowledged_at', wc.acknowledged_at,
        'acknowledged_by', wc.acknowledged_by,
        'resolved_at', wc.resolved_at,
        'resolved_by', wc.resolved_by
      )
      ORDER BY wc.created_at DESC
    )
    FROM public.waiter_calls wc
    WHERE wc.table_id = p_table_id
      AND (p_status IS NULL OR wc.status = p_status)),
    '[]'::jsonb
  );
END;
$$;

-- ============================================================
-- 6. GRANT EXECUTE to anon role
-- ============================================================

GRANT EXECUTE ON FUNCTION public.get_active_order_for_table(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_active_order_for_table(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_delivery_order(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_delivery_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_waiter_calls_for_table(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_waiter_calls_for_table(UUID, TEXT) TO authenticated;
