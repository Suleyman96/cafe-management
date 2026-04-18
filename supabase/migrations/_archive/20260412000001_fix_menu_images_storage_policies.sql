-- Fix: Add missing storage RLS policies for menu-images bucket
-- The bucket exists in config.toml but had no policies, blocking authenticated uploads.

-- Ensure bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('menu-images', 'menu-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Public read access for menu images
CREATE POLICY "Public read access for menu images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'menu-images');

-- Authenticated staff can upload menu images
CREATE POLICY "Staff can upload menu images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'menu-images' AND auth.role() = 'authenticated');

-- Authenticated staff can update menu images
CREATE POLICY "Staff can update menu images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'menu-images' AND auth.role() = 'authenticated');

-- Authenticated staff can delete menu images
CREATE POLICY "Staff can delete menu images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'menu-images' AND auth.role() = 'authenticated');
