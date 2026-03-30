-- Fix: prevent closed tables from being set to 'occupied' by order insert trigger
-- Bug: when an order was created for a closed table, the trigger unconditionally
-- set the table status to 'occupied', overriding the 'closed' status.

CREATE OR REPLACE FUNCTION public.update_table_status_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.tables
    SET
      status = 'occupied',
      occupied_at = NOW(),
      current_session_id = NEW.id
    WHERE id = NEW.table_id
      AND status != 'closed';
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'closed' AND OLD.status != 'closed' THEN
    UPDATE public.tables
    SET
      status = 'free',
      current_session_id = NULL
    WHERE id = NEW.table_id;
  END IF;

  RETURN NEW;
END;
$$;
