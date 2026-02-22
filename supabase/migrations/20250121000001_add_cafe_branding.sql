-- Migration: Add cafe branding fields for white-label multi-tenant support
-- Includes: visual branding, welcome screen customization, social links, and feature controls

-- Add all branding fields to cafe_settings
ALTER TABLE cafe_settings
-- Visual branding
ADD COLUMN IF NOT EXISTS cafe_logo_url TEXT,
ADD COLUMN IF NOT EXISTS hero_image_url TEXT,
ADD COLUMN IF NOT EXISTS brand_primary_color VARCHAR(7) DEFAULT '#3B82F6',
ADD COLUMN IF NOT EXISTS brand_secondary_color VARCHAR(7) DEFAULT '#1E40AF',
-- Welcome screen customization
ADD COLUMN IF NOT EXISTS welcome_heading VARCHAR(255),
ADD COLUMN IF NOT EXISTS welcome_message TEXT,
-- Feature controls
ADD COLUMN IF NOT EXISTS qr_ordering_enabled BOOLEAN NOT NULL DEFAULT true,
-- Contact & social links
ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS contact_website TEXT,
ADD COLUMN IF NOT EXISTS social_instagram TEXT,
ADD COLUMN IF NOT EXISTS social_whatsapp TEXT,
ADD COLUMN IF NOT EXISTS location_maps_url TEXT;

-- Create storage bucket for branding assets (logos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy for public read access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'objects'
        AND policyname = 'Public read access for branding'
    ) THEN
        CREATE POLICY "Public read access for branding"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'branding');
    END IF;
END $$;

-- Storage policy for authenticated uploads
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'objects'
        AND policyname = 'Authenticated users can upload branding'
    ) THEN
        CREATE POLICY "Authenticated users can upload branding"
        ON storage.objects FOR INSERT
        WITH CHECK (bucket_id = 'branding' AND auth.role() = 'authenticated');
    END IF;
END $$;

-- Storage policy for authenticated updates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'objects'
        AND policyname = 'Authenticated users can update branding'
    ) THEN
        CREATE POLICY "Authenticated users can update branding"
        ON storage.objects FOR UPDATE
        USING (bucket_id = 'branding' AND auth.role() = 'authenticated');
    END IF;
END $$;

-- Storage policy for authenticated deletes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'objects'
        AND policyname = 'Authenticated users can delete branding'
    ) THEN
        CREATE POLICY "Authenticated users can delete branding"
        ON storage.objects FOR DELETE
        USING (bucket_id = 'branding' AND auth.role() = 'authenticated');
    END IF;
END $$;
