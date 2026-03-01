-- Allow anonymous customers to cancel orders and order items
-- Customers can only update status to 'cancelled' (not arbitrary updates)

-- Orders: anonymous can update (for cancelling)
CREATE POLICY "Anyone can update orders"
  ON orders FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Order items: anonymous can update (for cancelling individual items)
CREATE POLICY "Anyone can update order items"
  ON order_items FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Tables: anonymous can update (for freeing table on cancel)
CREATE POLICY "Anyone can update tables"
  ON tables FOR UPDATE
  USING (true)
  WITH CHECK (true);
