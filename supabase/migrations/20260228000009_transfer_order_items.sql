-- Transfer individual order items between tables
-- Supports partial quantity transfers and auto-creates destination orders

CREATE OR REPLACE FUNCTION public.transfer_order_items(
  p_source_order_id UUID,
  p_destination_table_id UUID,
  p_items JSONB,  -- array of {"item_id": uuid, "quantity": int}
  p_staff_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID  -- returns destination order ID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_dest_order_id UUID;
  v_source_table_id UUID;
  v_source_order_status VARCHAR(20);
  v_item RECORD;
  v_source_item RECORD;
  v_remaining_items INTEGER;
BEGIN
  -- Validate source order exists and get its table
  SELECT table_id, status INTO v_source_table_id, v_source_order_status
  FROM public.orders
  WHERE id = p_source_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source order not found';
  END IF;

  IF v_source_order_status IN ('closed', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot transfer items from a closed or cancelled order';
  END IF;

  IF v_source_table_id = p_destination_table_id THEN
    RAISE EXCEPTION 'Cannot transfer to the same table';
  END IF;

  -- Find existing active order on destination table, or create new one
  SELECT id INTO v_dest_order_id
  FROM public.orders
  WHERE table_id = p_destination_table_id
    AND status IN ('new', 'preparing', 'ready', 'served')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_dest_order_id IS NULL THEN
    -- Create new order on destination table
    INSERT INTO public.orders (table_id, order_type, status, assigned_waiter_id)
    VALUES (p_destination_table_id, 'dine_in', 'new', p_staff_id)
    RETURNING id INTO v_dest_order_id;

    -- Occupy destination table
    UPDATE public.tables
    SET
      status = 'occupied',
      current_session_id = v_dest_order_id,
      occupied_at = NOW(),
      updated_at = NOW()
    WHERE id = p_destination_table_id;
  END IF;

  -- Process each item transfer
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(item_id UUID, quantity INTEGER)
  LOOP
    -- Get source item details
    SELECT * INTO v_source_item
    FROM public.order_items
    WHERE id = v_item.item_id
      AND order_id = p_source_order_id
      AND status != 'cancelled';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item % not found in source order or is cancelled', v_item.item_id;
    END IF;

    IF v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Transfer quantity must be positive';
    END IF;

    IF v_item.quantity > v_source_item.quantity THEN
      RAISE EXCEPTION 'Transfer quantity (%) exceeds available quantity (%)',
        v_item.quantity, v_source_item.quantity;
    END IF;

    IF v_item.quantity >= v_source_item.quantity THEN
      -- Transfer entire item: delete from source, create in destination
      DELETE FROM public.order_items WHERE id = v_item.item_id;

      INSERT INTO public.order_items (
        order_id, menu_item_id, item_name, quantity, item_price, notes, status
      ) VALUES (
        v_dest_order_id, v_source_item.menu_item_id, v_source_item.item_name,
        v_source_item.quantity, v_source_item.item_price, v_source_item.notes,
        v_source_item.status
      );
    ELSE
      -- Partial transfer: reduce source quantity, create new in destination
      UPDATE public.order_items
      SET quantity = quantity - v_item.quantity
      WHERE id = v_item.item_id;

      INSERT INTO public.order_items (
        order_id, menu_item_id, item_name, quantity, item_price, notes, status
      ) VALUES (
        v_dest_order_id, v_source_item.menu_item_id, v_source_item.item_name,
        v_item.quantity, v_source_item.item_price, v_source_item.notes,
        v_source_item.status
      );
    END IF;
  END LOOP;

  -- Recalculate totals for both orders
  PERFORM public.calculate_order_total(p_source_order_id);
  PERFORM public.calculate_order_total(v_dest_order_id);

  -- Check if source order has remaining non-cancelled items
  SELECT COUNT(*) INTO v_remaining_items
  FROM public.order_items
  WHERE order_id = p_source_order_id
    AND status != 'cancelled';

  IF v_remaining_items = 0 THEN
    -- All items transferred — cancel source order
    UPDATE public.orders
    SET status = 'cancelled',
        internal_notes = 'All items transferred to another table',
        updated_at = NOW()
    WHERE id = p_source_order_id;

    -- Free source table if no other active orders
    IF NOT EXISTS (
      SELECT 1 FROM public.orders
      WHERE table_id = v_source_table_id
        AND id != p_source_order_id
        AND status IN ('new', 'preparing', 'ready', 'served')
    ) THEN
      UPDATE public.tables
      SET status = 'free',
          current_session_id = NULL,
          updated_at = NOW()
      WHERE id = v_source_table_id;
    END IF;
  END IF;

  -- Log the transfer
  INSERT INTO public.table_transfers (
    order_id, from_table_id, to_table_id, transferred_by, reason
  ) VALUES (
    p_source_order_id, v_source_table_id, p_destination_table_id, p_staff_id, p_reason
  );

  RETURN v_dest_order_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.transfer_order_items(UUID, UUID, JSONB, UUID, TEXT) TO authenticated;
