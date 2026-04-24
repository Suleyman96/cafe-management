-- Storage RLS policies for branding and menu-images buckets.
-- Only authenticated staff can upload/update/delete. Anyone can read (public buckets).

-- Ensure branding bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('branding', 'branding', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- === Branding bucket policies ===

DROP POLICY IF EXISTS "Public read access for branding" ON storage.objects;
CREATE POLICY "Public read access for branding"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'branding');

DROP POLICY IF EXISTS "Authenticated users can upload branding" ON storage.objects;
CREATE POLICY "Authenticated users can upload branding"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'branding'
    AND (storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp', 'svg'))
  );

DROP POLICY IF EXISTS "Authenticated users can update branding" ON storage.objects;
CREATE POLICY "Authenticated users can update branding"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'branding');

DROP POLICY IF EXISTS "Authenticated users can delete branding" ON storage.objects;
CREATE POLICY "Authenticated users can delete branding"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'branding');

-- === Menu-images bucket policies ===

DROP POLICY IF EXISTS "Public read access for menu images" ON storage.objects;
CREATE POLICY "Public read access for menu images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'menu-images');

DROP POLICY IF EXISTS "Staff can upload menu images" ON storage.objects;
CREATE POLICY "Staff can upload menu images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'menu-images'
    AND (storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp'))
  );

DROP POLICY IF EXISTS "Staff can update menu images" ON storage.objects;
CREATE POLICY "Staff can update menu images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'menu-images');

DROP POLICY IF EXISTS "Staff can delete menu images" ON storage.objects;
CREATE POLICY "Staff can delete menu images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'menu-images');
