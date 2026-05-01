-- Tier 3 hardening (SCALE-21): tighten branding-bucket upload allowlist.
--
-- Before: 20260501000001_storage_tenant_scoping.sql granted INSERT to objects
-- with extension in ('jpg','jpeg','png','webp','svg'). SVG accepted because
-- the bucket originally hosted hand-uploaded vector logos, but SVG can
-- carry inline <script> and event handlers and the Storage public URL serves
-- it with `Content-Type: image/svg+xml` — a real XSS vector when a user
-- opens the URL directly or embeds it via <object>/<embed>.
--
-- After: branding allowlist matches the menu-images allowlist
-- ('jpg','jpeg','png','webp'). Client-side `validateImageFile` already
-- rejects SVG by MIME + magic-byte check; this closes the corresponding
-- server-side gap.
--
-- No backfill needed — `cafe_settings.cafe_logo_url` and `hero_image_url`
-- have always been written by the WebP-converting upload component, so no
-- existing branding object should be SVG. New uploads cannot reintroduce
-- SVG.

BEGIN;

DROP POLICY IF EXISTS "Tenant staff can upload branding" ON storage.objects;

CREATE POLICY "Tenant staff can upload branding"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'branding'
    AND storage.extension(name) IN ('jpg', 'jpeg', 'png', 'webp')
    AND split_part(name, '/', 1) = public.current_tenant_id_text()
  );

COMMIT;
