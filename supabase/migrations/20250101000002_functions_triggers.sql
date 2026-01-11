-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function: Generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR(10) AS $$
DECLARE
  new_number VARCHAR(10);
  counter INTEGER;
BEGIN
  SELECT COUNT(*) INTO counter
  FROM orders
  WHERE DATE(created_at) = CURRENT_DATE;
  
  new_number := 'ORD' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || LPAD((counter + 1)::TEXT, 3, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function: Set order number on insert
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Function: Calculate order total
CREATE OR REPLACE FUNCTION calculate_order_total(order_uuid UUID)
RETURNS VOID AS $$
DECLARE
  calculated_subtotal DECIMAL(10, 2);
  calculated_tax DECIMAL(10, 2);
  calculated_total DECIMAL(10, 2);
  tax_rate DECIMAL(5, 4) := 0.18; -- 18% tax
BEGIN
  SELECT COALESCE(SUM(item_price * quantity), 0)
  INTO calculated_subtotal
  FROM order_items
  WHERE order_id = order_uuid;
  
  calculated_tax := calculated_subtotal * tax_rate;
  calculated_total := calculated_subtotal + calculated_tax;
  
  UPDATE orders
  SET 
    subtotal = calculated_subtotal,
    tax = calculated_tax,
    total = calculated_total,
    updated_at = NOW()
  WHERE id = order_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function: Recalculate order total on item changes
CREATE OR REPLACE FUNCTION recalculate_order_total()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_order_total(COALESCE(NEW.order_id, OLD.order_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recalculate_on_item_insert
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_order_total();

CREATE TRIGGER recalculate_on_item_update
  AFTER UPDATE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_order_total();

CREATE TRIGGER recalculate_on_item_delete
  AFTER DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_order_total();

-- Function: Update table status on order changes
CREATE OR REPLACE FUNCTION update_table_status_on_order()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tables
    SET 
      status = 'occupied',
      occupied_at = NOW(),
      current_session_id = NEW.id
    WHERE id = NEW.table_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'closed' AND OLD.status != 'closed' THEN
    UPDATE tables
    SET 
      status = 'free',
      current_session_id = NULL
    WHERE id = NEW.table_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_table_on_order
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_table_status_on_order();

-- Function: Set table context for customers (RLS)
CREATE OR REPLACE FUNCTION set_table_context(qr_token TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.qr_token', qr_token, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


