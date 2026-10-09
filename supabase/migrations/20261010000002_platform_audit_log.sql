-- L12: audit trail for platform-operator (super-admin) mutations.
--
-- The `/api/v1/platform/*` console lets a gustri operator create tenants and
-- change their plan / active status across every tenant. Those actions were not
-- recorded anywhere. `financial_audit_log` does not fit: its rows REQUIRE an
-- `order_id` (NOT NULL FK to orders) and are tenant-scoped for RLS, whereas an
-- operator action targets a TENANT and has no order. So this adds a dedicated,
-- cross-tenant operator audit table.
--
-- Identity note: platform admins are an email allowlist in env
-- (`PLATFORM_ADMIN_EMAILS`), NOT a DB role — there is no SQL predicate that
-- identifies "a platform admin". Reads and writes therefore go through the
-- service-role client behind the `verifyPlatformAdmin` gate, which bypasses RLS.
-- RLS is still ENABLED with an explicit deny-all policy so that no ordinary
-- tenant (authenticated) user can ever read another tenant's operator history.

BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Operator identity (from the verified, confirmed auth email + user id).
  actor_id UUID,
  actor_email TEXT NOT NULL,
  -- Target tenant of the action.
  tenant_id UUID,
  -- 'tenant_create', 'plan_change', 'status_change'.
  action TEXT NOT NULL,
  -- Before / after snapshots (nullable: a create has no "before").
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Operator console lists most-recent actions, optionally filtered by tenant.
CREATE INDEX IF NOT EXISTS idx_platform_audit_created ON public.platform_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_tenant ON public.platform_audit_log (tenant_id, created_at DESC);

ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;

-- Deny all access to ordinary authenticated (tenant) users. Operator reads and
-- writes run via the service-role client (verifyPlatformAdmin gate), which
-- bypasses RLS entirely. This explicit false policy documents the intent and
-- guarantees a tenant can never see cross-tenant operator activity.
DROP POLICY IF EXISTS "deny_tenant_access" ON public.platform_audit_log;
CREATE POLICY "deny_tenant_access" ON public.platform_audit_log
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

COMMIT;
