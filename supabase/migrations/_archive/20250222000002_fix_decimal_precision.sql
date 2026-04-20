-- Fix DECIMAL columns to use explicit precision
-- Prevents floating-point serialization issues in PostgREST/Supabase

ALTER TABLE stock_items
  ALTER COLUMN quantity TYPE NUMERIC(12,2),
  ALTER COLUMN cost_price TYPE NUMERIC(12,2),
  ALTER COLUMN minimum_stock_level TYPE NUMERIC(12,2);

ALTER TABLE stock_movements
  ALTER COLUMN quantity_change TYPE NUMERIC(12,2),
  ALTER COLUMN quantity_after TYPE NUMERIC(12,2);

ALTER TABLE expenses
  ALTER COLUMN amount TYPE NUMERIC(12,2);
