-- H4 from plans/09-DB-SECURITY-DEFERRED.md: tenant-scope the storage buckets.
--
-- Before: `branding` and `menu-images` policies key only on `bucket_id`, so any
-- authenticated staff member can write/update/delete any other tenant's logo
-- or menu image. Reads are public by design — only mutations need the gate.
--
-- After: every mutation must place / mutate / delete an object whose path
-- starts with the caller's `tenant_id`, e.g. `branding/<tenant_id>/logos/x.webp`.
-- The first path segment is derived from the caller's staff row, not from
-- a parameter, so it cannot be forged.
--
-- Backfill (single-tenant — only one `cafe_settings` row exists today):
--   1) prepend `<tenant_id>/` to existing object names in both buckets
--   2) rewrite the stored URLs in `cafe_settings.cafe_logo_url`,
--      `cafe_settings.hero_image_url`, and `menu_items.image_url` so the
--      public URL still resolves after the rename.
--
-- This migration must be run after `20260430000002_multitenant_security_hardening.sql`
-- since it depends on `current_tenant_id()` being staff-derived for authenticated
-- callers.

BEGIN;

-- ============================================================
-- 1. Helper: caller's tenant id as text for storage path prefix.
--    Read from the staff row (not the GUC) so an `anon` QR-flow caller
--    cannot use this surface — anon stays read-only on these buckets.
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_tenant_id_text() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT s.tenant_id::text
  FROM public.staff s
  WHERE s.auth_user_id = auth.uid()
    AND s.is_active = true
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.current_tenant_id_text() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.current_tenant_id_text() TO authenticated;

-- ============================================================
-- 2. Backfill paths in storage.objects to be tenant-prefixed.
--    Skip rows that are already prefixed (idempotency).
-- ============================================================

DO $$
DECLARE
  v_tenant_id_text text;
BEGIN
  SELECT tenant_id::text INTO v_tenant_id_text
  FROM public.cafe_settings
  ORDER BY created_at NULLS FIRST
  LIMIT 1;

  IF v_tenant_id_text IS NULL THEN
    RAISE NOTICE 'No cafe_settings row — skipping storage object rename';
    RETURN;
  END IF;

  UPDATE storage.objects
     SET name = v_tenant_id_text || '/' || name
   WHERE bucket_id IN ('branding', 'menu-images')
     AND split_part(name, '/', 1) <> v_tenant_id_text;

  -- Rewrite the URL columns that reference the renamed paths. The public URL
  -- format is `<base>/storage/v1/object/public/<bucket>/<path>`; we splice
  -- `<tenant_id>/` between the bucket and the path, but only for URLs that
  -- haven't already been migrated.
  UPDATE public.cafe_settings
     SET cafe_logo_url = regexp_replace(
           cafe_logo_url,
           '(/storage/v1/object/public/branding/)(?!' || v_tenant_id_text || '/)',
           '\1' || v_tenant_id_text || '/'
         )
   WHERE cafe_logo_url IS NOT NULL
     AND cafe_logo_url LIKE '%/storage/v1/object/public/branding/%'
     AND cafe_logo_url NOT LIKE '%/storage/v1/object/public/branding/' || v_tenant_id_text || '/%';

  UPDATE public.cafe_settings
     SET hero_image_url = regexp_replace(
           hero_image_url,
           '(/storage/v1/object/public/branding/)(?!' || v_tenant_id_text || '/)',
           '\1' || v_tenant_id_text || '/'
         )
   WHERE hero_image_url IS NOT NULL
     AND hero_image_url LIKE '%/storage/v1/object/public/branding/%'
     AND hero_image_url NOT LIKE '%/storage/v1/object/public/branding/' || v_tenant_id_text || '/%';

  UPDATE public.menu_items
     SET image_url = regexp_replace(
           image_url,
           '(/storage/v1/object/public/menu-images/)(?!' || v_tenant_id_text || '/)',
           '\1' || v_tenant_id_text || '/'
         )
   WHERE image_url IS NOT NULL
     AND image_url LIKE '%/storage/v1/object/public/menu-images/%'
     AND image_url NOT LIKE '%/storage/v1/object/public/menu-images/' || v_tenant_id_text || '/%';
END $$;

-- ============================================================
-- 3. Replace the bucket-only policies with tenant-prefix policies.
--    Reads stay public (the buckets serve customer-facing menus and
--    branding directly to browsers); writes/updates/deletes require
--    the path's first segment to equal the caller's tenant.
-- ============================================================

-- Branding bucket
DROP POLICY IF EXISTS "Authenticated users can upload branding"  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update branding"  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete branding"  ON storage.objects;

CREATE POLICY "Tenant staff can upload branding"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'branding'
    AND storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp', 'svg')
    AND split_part(name, '/', 1) = public.current_tenant_id_text()
  );

CREATE POLICY "Tenant staff can update own branding"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'branding'
    AND split_part(name, '/', 1) = public.current_tenant_id_text()
  )
  WITH CHECK (
    bucket_id = 'branding'
    AND split_part(name, '/', 1) = public.current_tenant_id_text()
  );

CREATE POLICY "Tenant staff can delete own branding"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'branding'
    AND split_part(name, '/', 1) = public.current_tenant_id_text()
  );

-- Menu-images bucket
DROP POLICY IF EXISTS "Staff can upload menu images"  ON storage.objects;
DROP POLICY IF EXISTS "Staff can update menu images"  ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete menu images"  ON storage.objects;

CREATE POLICY "Tenant staff can upload menu images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'menu-images'
    AND storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp')
    AND split_part(name, '/', 1) = public.current_tenant_id_text()
  );

CREATE POLICY "Tenant staff can update own menu images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND split_part(name, '/', 1) = public.current_tenant_id_text()
  )
  WITH CHECK (
    bucket_id = 'menu-images'
    AND split_part(name, '/', 1) = public.current_tenant_id_text()
  );

CREATE POLICY "Tenant staff can delete own menu images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND split_part(name, '/', 1) = public.current_tenant_id_text()
  );

COMMIT;
