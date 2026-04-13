-- Cafe Settings table for storing configurable settings
-- This is a single-row table that stores all cafe configuration

CREATE TABLE cafe_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Restaurant info
  restaurant_name VARCHAR(255) NOT NULL DEFAULT 'Gustri',

  -- Tax settings
  tax_enabled BOOLEAN NOT NULL DEFAULT false,
  tax_percentage DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
  tax_label VARCHAR(50) NOT NULL DEFAULT 'Tax',
  prices_include_tax BOOLEAN NOT NULL DEFAULT false,
  show_tax_separately BOOLEAN NOT NULL DEFAULT true,

  -- Currency settings
  currency_symbol VARCHAR(10) NOT NULL DEFAULT '¥',
  currency_code VARCHAR(3) NOT NULL DEFAULT 'JPY',
  currency_position VARCHAR(10) NOT NULL DEFAULT 'before' CHECK (currency_position IN ('before', 'after')),
  currency_decimal_places INTEGER NOT NULL DEFAULT 0,

  -- Order settings
  minimum_order_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  allow_item_notes BOOLEAN NOT NULL DEFAULT true,
  allow_order_notes BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO cafe_settings (id) VALUES ('00000000-0000-0000-0000-000000000001');

-- Ensure only one row exists
CREATE OR REPLACE FUNCTION enforce_single_cafe_settings()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM cafe_settings) > 0 THEN
    RAISE EXCEPTION 'Only one cafe_settings row is allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_single_cafe_settings
  BEFORE INSERT ON cafe_settings
  FOR EACH ROW
  WHEN (NEW.id != '00000000-0000-0000-0000-000000000001')
  EXECUTE FUNCTION enforce_single_cafe_settings();

-- Update timestamp trigger
CREATE TRIGGER update_cafe_settings_timestamp
  BEFORE UPDATE ON cafe_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Disable RLS for dev (consistent with other tables)
ALTER TABLE cafe_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read settings (needed for customer app)
CREATE POLICY "Anyone can read cafe settings"
  ON cafe_settings FOR SELECT
  USING (true);

-- Only admins can update settings
CREATE POLICY "Admins can update cafe settings"
  ON cafe_settings FOR UPDATE
  USING (true);
