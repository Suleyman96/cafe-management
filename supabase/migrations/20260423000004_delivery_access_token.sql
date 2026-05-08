-- SCALE-6: Add access token column to orders for delivery order tracking security
-- This prevents IDOR vulnerability where any user with a UUID could access delivery order details

-- Add access token column
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_access_token TEXT;

-- Generate tokens for existing delivery orders.
-- pgcrypto is installed in the `extensions` schema on Supabase, so we
-- qualify the call rather than rely on search_path (Supabase's hardened
-- search_path doesn't include `extensions` for safety reasons).
UPDATE public.orders
SET delivery_access_token = encode(extensions.gen_random_bytes(16), 'hex')
WHERE order_type = 'delivery'
  AND delivery_access_token IS NULL;

-- Set default for new rows
ALTER TABLE public.orders
ALTER COLUMN delivery_access_token SET DEFAULT encode(extensions.gen_random_bytes(16), 'hex');

-- Drop the old single-argument version (PostgreSQL treats different signatures as different functions)
DROP FUNCTION IF EXISTS public.get_delivery_order(UUID);

-- Replace with new function that requires access token
CREATE OR REPLACE FUNCTION public.get_delivery_order(
  p_order_id UUID,
  p_access_token TEXT DEFAULT NULL
)
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
  WHERE o.id = p_order_id
    AND o.delivery_access_token = p_access_token;

  RETURN result;
END;
$$;

-- Grant execute to both roles
GRANT EXECUTE ON FUNCTION public.get_delivery_order(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_delivery_order(UUID, TEXT) TO authenticated;
