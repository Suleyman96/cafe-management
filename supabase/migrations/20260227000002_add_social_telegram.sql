-- Add Telegram, LINE social link columns, restaurant address, and default language to cafe_settings
ALTER TABLE cafe_settings
ADD COLUMN IF NOT EXISTS social_telegram TEXT;

ALTER TABLE cafe_settings
ADD COLUMN IF NOT EXISTS social_line TEXT;

ALTER TABLE cafe_settings
ADD COLUMN IF NOT EXISTS restaurant_address TEXT;

ALTER TABLE cafe_settings
ADD COLUMN IF NOT EXISTS default_language VARCHAR(5) DEFAULT 'en';
