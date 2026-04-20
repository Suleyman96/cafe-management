-- Add waste_tracking_enabled setting to cafe_settings
ALTER TABLE cafe_settings ADD COLUMN IF NOT EXISTS waste_tracking_enabled BOOLEAN NOT NULL DEFAULT false;
