-- Add TikTok social link column to cafe_settings
ALTER TABLE cafe_settings
ADD COLUMN IF NOT EXISTS social_tiktok TEXT;
