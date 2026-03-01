-- Fix 1: Change table_transfers foreign keys from RESTRICT to CASCADE
-- so that deleting a table also removes its transfer history
ALTER TABLE public.table_transfers DROP CONSTRAINT IF EXISTS table_transfers_from_table_id_fkey;
ALTER TABLE public.table_transfers DROP CONSTRAINT IF EXISTS table_transfers_to_table_id_fkey;

ALTER TABLE public.table_transfers
  ADD CONSTRAINT table_transfers_from_table_id_fkey
  FOREIGN KEY (from_table_id) REFERENCES public.tables(id) ON DELETE CASCADE;

ALTER TABLE public.table_transfers
  ADD CONSTRAINT table_transfers_to_table_id_fkey
  FOREIGN KEY (to_table_id) REFERENCES public.tables(id) ON DELETE CASCADE;

-- Fix 2: Update transfer_table function to allow occupied tables
-- The UI already has "Transfer Anyway" button for occupied tables
CREATE OR REPLACE FUNCTION public.transfer_table(
  p_order_id UUID,
  p_from_table_id UUID,
  p_to_table_id UUID,
  p_staff_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_status TEXT;
BEGIN
  -- Validate order belongs to source table
  SELECT status INTO v_order_status
  FROM public.orders
  WHERE id = p_order_id AND table_id = p_from_table_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % does not belong to table %', p_order_id, p_from_table_id;
  END IF;

  IF v_order_status = 'closed' OR v_order_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot transfer closed or cancelled order';
  END IF;

  -- Only reject closed tables, allow free/reserved/occupied
  IF EXISTS (
    SELECT 1 FROM public.tables
    WHERE id = p_to_table_id
    AND status = 'closed'
  ) THEN
    RAISE EXCEPTION 'Target table is closed';
  END IF;

  -- Move order to destination table
  UPDATE public.orders
  SET
    table_id = p_to_table_id,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Free source table if no other active orders remain
  IF NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE table_id = p_from_table_id
    AND id != p_order_id
    AND status IN ('new', 'preparing', 'ready', 'served')
  ) THEN
    UPDATE public.tables
    SET
      status = 'free',
      current_session_id = NULL,
      updated_at = NOW()
    WHERE id = p_from_table_id;
  END IF;

  -- Occupy destination table
  UPDATE public.tables
  SET
    status = 'occupied',
    current_session_id = p_order_id,
    occupied_at = NOW(),
    updated_at = NOW()
  WHERE id = p_to_table_id;

  -- Log the transfer
  INSERT INTO public.table_transfers (
    order_id, from_table_id, to_table_id, transferred_by, reason
  ) VALUES (
    p_order_id, p_from_table_id, p_to_table_id, p_staff_id, p_reason
  );

  RETURN TRUE;
END;
$$;
