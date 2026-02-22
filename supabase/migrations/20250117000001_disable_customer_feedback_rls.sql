-- Disable RLS for customer_feedback table in development
-- This allows the customer-web app to submit feedback without QR token authentication

ALTER TABLE customer_feedback DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE customer_feedback IS 'RLS disabled for development - enable in production';

-- Also ensure staff_notes has RLS disabled if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_notes') THEN
        ALTER TABLE staff_notes DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;
