-- Tenant soft-close (account closure / GDPR erasure v1).
--
-- A tenant owner can close their account. This is a *reversible* soft-close:
-- the tenant row is marked inactive and every access path fails closed, but the
-- data is retained so support can restore within the grace period and a
-- deliberate hard-purge can run later. No self-serve reactivation — reopening
-- is a support action (a deactivated owner is intentionally locked out of the
-- write path, see verify-tenant-claim.ts), which is why it must not gate its
-- own undo.
--
-- Enforcement is centralized in current_tenant_id() / current_tenant_id_text():
-- once tenants.is_active = false, both return NULL, so every
-- `tenant_id = current_tenant_id()` RLS policy denies for BOTH authenticated
-- staff and anon/QR customers in one stroke. Service-role /api/v1/* endpoints
-- bypass RLS, so those are gated separately in verifyTenantClaim.

-- 1. Closure audit metadata. Nullable; only set when a tenant is closed.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_by uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deactivation_reason text;

-- 2. current_tenant_id(): resolve to the tenant ONLY when it is active.
--    Wrapping the previous CASE in a `tenants` lookup keyed on is_active means
--    a closed tenant collapses to NULL for every RLS check, immediately, for
--    both the authenticated-staff path and the anon/QR GUC path. Behavior is
--    unchanged for active tenants (the common case).
CREATE OR REPLACE FUNCTION public.current_tenant_id() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT t.id
  FROM public.tenants t
  WHERE t.is_active = true
    AND t.id = (
      CASE
        WHEN auth.uid() IS NOT NULL THEN
          (SELECT s.tenant_id FROM public.staff s
            WHERE s.auth_user_id = auth.uid() AND s.is_active = true
            LIMIT 1)
        ELSE
          NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
      END
    )
  LIMIT 1;
$$;

-- 3. current_tenant_id_text() (storage.objects tenant scoping): same gate so a
--    closed tenant also loses storage access.
CREATE OR REPLACE FUNCTION public.current_tenant_id_text() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT t.id::text
  FROM public.tenants t
  JOIN public.staff s ON s.tenant_id = t.id
  WHERE s.auth_user_id = auth.uid()
    AND s.is_active = true
    AND t.is_active = true
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.current_tenant_id_text() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.current_tenant_id_text() TO authenticated;
