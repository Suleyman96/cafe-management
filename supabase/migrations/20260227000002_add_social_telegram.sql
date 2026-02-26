-- Add Telegram, LINE social link columns and restaurant address to cafe_settings
ALTER TABLE cafe_settings
ADD COLUMN IF NOT EXISTS social_telegram TEXT;

ALTER TABLE cafe_settings
ADD COLUMN IF NOT EXISTS social_line TEXT;

ALTER TABLE cafe_settings
ADD COLUMN IF NOT EXISTS restaurant_address TEXT;
