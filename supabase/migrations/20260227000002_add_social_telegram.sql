-- Add Telegram and LINE social link columns to cafe_settings
ALTER TABLE cafe_settings
ADD COLUMN IF NOT EXISTS social_telegram TEXT;

ALTER TABLE cafe_settings
ADD COLUMN IF NOT EXISTS social_line TEXT;
