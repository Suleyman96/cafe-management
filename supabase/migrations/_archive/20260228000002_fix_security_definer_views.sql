-- Fix Security Definer Views
-- Change from SECURITY DEFINER (bypasses RLS) to SECURITY INVOKER (respects RLS)

ALTER VIEW active_orders_view SET (security_invoker = on);
ALTER VIEW sales_summary_view SET (security_invoker = on);
ALTER VIEW order_payment_summary SET (security_invoker = on);
