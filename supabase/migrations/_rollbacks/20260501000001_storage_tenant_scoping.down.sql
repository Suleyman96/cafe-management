-- Rollback for 20260501000001_storage_tenant_scoping.sql.
--
-- Reverts the storage policies to their pre-H4 form (`bucket_id`-only) and
-- strips the tenant prefix from object names + DB URL columns. Safe to run
-- against a database that hasn't been migrated (the strip is idempotent
-- because it only touches paths that DO start with `<tenant_id>/`).

BEGIN;

-- 1. Reverse the URL backfill: strip the tenant prefix from object paths
--    and stored URLs.

DO $$
DECLARE
  v_tenant_id_text text;
BEGIN
  SELECT tenant_id::text INTO v_tenant_id_text
  FROM public.cafe_settings
  ORDER BY created_at NULLS FIRST
  LIMIT 1;

  IF v_tenant_id_text IS NULL THEN
    RAISE NOTICE 'No cafe_settings row — skipping reverse rename';
    RETURN;
  END IF;

  UPDATE storage.objects
     SET name = substring(name FROM (length(v_tenant_id_text) + 2))
   WHERE bucket_id IN ('branding', 'menu-images')
     AND split_part(name, '/', 1) = v_tenant_id_text;

  UPDATE public.cafe_settings
     SET cafe_logo_url = replace(
           cafe_logo_url,
           '/storage/v1/object/public/branding/' || v_tenant_id_text || '/',
           '/storage/v1/object/public/branding/'
         )
   WHERE cafe_logo_url LIKE '%/storage/v1/object/public/branding/' || v_tenant_id_text || '/%';

  UPDATE public.cafe_settings
     SET hero_image_url = replace(
           hero_image_url,
           '/storage/v1/object/public/branding/' || v_tenant_id_text || '/',
           '/storage/v1/object/public/branding/'
         )
   WHERE hero_image_url LIKE '%/storage/v1/object/public/branding/' || v_tenant_id_text || '/%';

  UPDATE public.menu_items
     SET image_url = replace(
           image_url,
           '/storage/v1/object/public/menu-images/' || v_tenant_id_text || '/',
           '/storage/v1/object/public/menu-images/'
         )
   WHERE image_url LIKE '%/storage/v1/object/public/menu-images/' || v_tenant_id_text || '/%';
END $$;

-- 2. Drop tenant-prefix policies and recreate the bucket-only originals.

DROP POLICY IF EXISTS "Tenant staff can upload branding"      ON storage.objects;
DROP POLICY IF EXISTS "Tenant staff can update own branding"  ON storage.objects;
DROP POLICY IF EXISTS "Tenant staff can delete own branding"  ON storage.objects;
DROP POLICY IF EXISTS "Tenant staff can upload menu images"   ON storage.objects;
DROP POLICY IF EXISTS "Tenant staff can update own menu images" ON storage.objects;
DROP POLICY IF EXISTS "Tenant staff can delete own menu images" ON storage.objects;

CREATE POLICY "Authenticated users can upload branding"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'branding'
    AND storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp', 'svg')
  );

CREATE POLICY "Authenticated users can update branding"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'branding');

CREATE POLICY "Authenticated users can delete branding"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'branding');

CREATE POLICY "Staff can upload menu images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'menu-images'
    AND storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp')
  );

CREATE POLICY "Staff can update menu images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'menu-images');

CREATE POLICY "Staff can delete menu images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'menu-images');

-- 3. Drop the helper.

DROP FUNCTION IF EXISTS public.current_tenant_id_text();

COMMIT;
