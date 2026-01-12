-- Disable RLS for all tables in development
-- This allows the app to work without authentication

-- Disable RLS on orders and related tables
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE tables DISABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_calls DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff DISABLE ROW LEVEL SECURITY;

-- Also disable on payment-related tables if they exist
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'order_payments') THEN
        ALTER TABLE order_payments DISABLE ROW LEVEL SECURITY;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'table_transfers') THEN
        ALTER TABLE table_transfers DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;

COMMENT ON TABLE orders IS 'RLS disabled for development - enable in production';
COMMENT ON TABLE order_items IS 'RLS disabled for development - enable in production';
COMMENT ON TABLE tables IS 'RLS disabled for development - enable in production';
COMMENT ON TABLE waiter_calls IS 'RLS disabled for development - enable in production';
