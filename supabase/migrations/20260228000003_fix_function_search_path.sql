-- Fix "Function Search Path Mutable" warnings
-- Set search_path to empty string on all public functions to prevent search_path hijacking

ALTER FUNCTION update_updated_at_column() SET search_path = '';
ALTER FUNCTION generate_order_number() SET search_path = '';
ALTER FUNCTION set_order_number() SET search_path = '';
ALTER FUNCTION calculate_order_total(UUID) SET search_path = '';
ALTER FUNCTION recalculate_order_total() SET search_path = '';
ALTER FUNCTION update_table_status_on_order() SET search_path = '';
ALTER FUNCTION set_table_context(TEXT) SET search_path = '';
ALTER FUNCTION enforce_single_cafe_settings() SET search_path = '';
ALTER FUNCTION get_order_remaining_balance(UUID) SET search_path = '';
ALTER FUNCTION transfer_table(UUID, UUID, UUID) SET search_path = '';
ALTER FUNCTION validate_payment_amount() SET search_path = '';
ALTER FUNCTION update_order_payment_status() SET search_path = '';
ALTER FUNCTION validate_items_payment() SET search_path = '';
ALTER FUNCTION auto_acknowledge_feedback() SET search_path = '';
