-- Enable Supabase Realtime for tables that need live updates

-- Enable realtime for waiter_calls (for staff calls page)
ALTER PUBLICATION supabase_realtime ADD TABLE waiter_calls;

-- Enable realtime for orders (for kitchen and orders page)
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- Enable realtime for order_items (for kitchen page to see item changes)
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;

-- Enable realtime for order_payments (for orders page payment updates)
ALTER PUBLICATION supabase_realtime ADD TABLE order_payments;

-- Set replica identity to FULL for better change tracking
ALTER TABLE waiter_calls REPLICA IDENTITY FULL;
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE order_items REPLICA IDENTITY FULL;
ALTER TABLE order_payments REPLICA IDENTITY FULL;

COMMENT ON TABLE waiter_calls IS 'Realtime enabled for live staff notifications';
COMMENT ON TABLE orders IS 'Realtime enabled for live kitchen and order updates';
COMMENT ON TABLE order_payments IS 'Realtime enabled for payment tracking';
