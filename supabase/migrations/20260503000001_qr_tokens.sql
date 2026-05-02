-- C1: qr_tokens — server-side proof a customer-web caller is acting on
-- behalf of a real tenant.
--
-- Background. The customer-facing order create route accepted `tenant_id`
-- straight from the request body and only validated it for `dine_in`
-- orders that also supplied `table_id`. For `takeout` and `delivery`,
-- an unauthenticated POST could spoof any victim tenant's UUID and flood
-- their kitchen, exhausting `monthly_order_count` plan caps. This migration
-- adds the table that backs the server-side derivation.
--
-- Trust model
-- - dine_in: the `table_id` itself is the proof. The route loads
--   `tables.tenant_id` and never reads tenant from the body. Tables are
--   physically printed on QR placards and their UUIDs leak naturally —
--   the worst an attacker can do is spam their *own* tenant's kitchen.
-- - takeout / delivery: there is no table to derive from. The route
--   requires a `qr_token` whose row in this table provides the tenant.
--   Tokens are unguessable secrets (32+ random bytes) embedded in the
--   QR URL the cafe prints/sends out for these flows.
--
-- Token issuance is admin/owner only and runs through RLS-gated
-- inserts on this table. The order service uses the service role to
-- LOOK UP tokens at request time, bypassing RLS — that's intentional
-- because anonymous customers must be able to redeem the token without
-- staff auth context.
--
-- TODO(#qr-token-rollout): backfill QR tokens for existing tenants and
-- regenerate printed QR codes. Until that ships, takeout/delivery flows
-- will reject all customer-web POSTs (the route requires the token).

BEGIN;

CREATE TABLE IF NOT EXISTS public.qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  table_id uuid NULL REFERENCES public.tables(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('takeout', 'delivery', 'dine_in')),
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NULL,
  revoked_at timestamptz NULL
);

COMMENT ON TABLE public.qr_tokens IS
  'Server-issued tokens embedded in QR URLs. The order create route '
  'looks up `token` to derive `tenant_id` for non-table flows '
  '(takeout/delivery), preventing tenant spoofing via the request body.';

COMMENT ON COLUMN public.qr_tokens.token IS
  'The opaque secret value embedded in the QR URL the cafe prints/sends. '
  'Treat as a bearer credential — anyone holding it can create orders '
  'for the bound tenant.';

CREATE INDEX IF NOT EXISTS idx_qr_tokens_tenant_kind
  ON public.qr_tokens (tenant_id, kind);

ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;

-- Admin/owner only for every op. Pattern matches M18
-- (20260502000001_close_cross_tenant_write_leaks.sql) — every policy
-- self-fences with both the role check and the tenant predicate so an
-- admin in tenant A can never operate on tenant B's tokens, even with
-- the OR-combined-permissive evaluation behavior.

CREATE POLICY "Admin/owner can select qr_tokens in tenant"
ON public.qr_tokens FOR SELECT TO authenticated
USING (
  public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text])
  AND tenant_id = public.current_tenant_id()
);

CREATE POLICY "Admin/owner can insert qr_tokens in tenant"
ON public.qr_tokens FOR INSERT TO authenticated
WITH CHECK (
  public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text])
  AND tenant_id = public.current_tenant_id()
);

CREATE POLICY "Admin/owner can update qr_tokens in tenant"
ON public.qr_tokens FOR UPDATE TO authenticated
USING (
  public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text])
  AND tenant_id = public.current_tenant_id()
)
WITH CHECK (
  public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text])
  AND tenant_id = public.current_tenant_id()
);

CREATE POLICY "Admin/owner can delete qr_tokens in tenant"
ON public.qr_tokens FOR DELETE TO authenticated
USING (
  public.get_my_staff_role() = ANY (ARRAY['admin'::text, 'owner'::text])
  AND tenant_id = public.current_tenant_id()
);

COMMIT;
