import { PLAN_LIMITS, type PlanName, ValidationError } from '@gustri/core';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Customer-facing qr_token resolver — closes the deferred multi-tenant SSR
 * gap from `plans/18-CUSTOMER-WEB-AUDIT-CONTINUATION.md`.
 *
 * Background. The customer-web `/delivery/menu` page used to fetch
 * categories + menu items via the anon Supabase client with no tenant
 * context bound. The `anon_read_menu_items` / `anon_read_categories`
 * RLS policies are `USING (true)` (intentionally — a restaurant menu is
 * public information), so a multi-tenant deployment would briefly render
 * a mixed-tenant menu in the SSR HTML before the client-side guard
 * redirected away. Single-tenant prod was unaffected; multi-tenant prod
 * needed proper tenant resolution server-side.
 *
 * This service validates the bearer `qr_token` from the customer's
 * `?token=…` URL, derives the tenant, and gates on the same
 * `PLAN_LIMITS[plan].qrOrdering` flag the order/engagement services
 * enforce. The route returns just the resolved `tenant_id`; the client
 * binds it via `db.setTenantContext(tenantId)` so subsequent wrapper
 * reads (`useMenuItems`, `useCategories`) get the
 * `applyTenantScope`-driven `.eq('tenant_id', …)` predicate the dine-in
 * flow already enjoys.
 *
 * Trust model. The resolver runs with `supabaseAdmin` (RLS-bypassing) so
 * it can read `qr_tokens` (admin/owner-only RLS) without staff auth
 * context. The token itself is the bearer credential — anyone holding
 * it can derive the tenant_id, same as anyone holding it can place an
 * order via `customer-order-service`. The service stays consistent with
 * `customer-order-service.ts:resolveTenantId` so a token revoked there
 * is also rejected here.
 */

type ResolveQrTokenInput = {
  qr_token: string;
};

type ResolveQrTokenResult = {
  tenant_id: string;
};

export async function resolveCustomerQrToken(
  supabaseAdmin: SupabaseClient,
  input: ResolveQrTokenInput,
): Promise<ResolveQrTokenResult> {
  const { data: tokenRow, error } = await supabaseAdmin
    .from('qr_tokens')
    .select('tenant_id, kind, expires_at, revoked_at')
    .eq('token', input.qr_token)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!tokenRow) throw new ValidationError('invalid_qr_token');

  // Revoked / expired / wrong-kind all surface as `invalid_qr_token` (same
  // shape `customer-order-service.ts` uses) so the client UI shows a
  // single "Invalid QR" message instead of leaking which failure mode
  // tripped — `plans/18` records this trade-off explicitly.
  if (tokenRow.revoked_at !== null) throw new ValidationError('invalid_qr_token');
  if (tokenRow.expires_at !== null && new Date(tokenRow.expires_at as string) <= new Date()) {
    throw new ValidationError('invalid_qr_token');
  }
  // The delivery-menu flow only validates `kind='delivery'` tokens;
  // dine_in / takeout have their own resolution paths and shouldn't
  // round-trip through this endpoint.
  if (tokenRow.kind !== 'delivery') throw new ValidationError('invalid_qr_token');

  const tenantId = tokenRow.tenant_id as string;

  // Plan gate (M3 parity). A free-tier tenant whose plan disables
  // `qrOrdering` shouldn't resolve a tenant context the customer-web
  // client would then use to scope menu reads — the menu page is the
  // entry point to the cart, which is already plan-gated downstream.
  // Failing fast here prevents a free-tier customer from browsing a
  // menu they can never check out from.
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('plan')
    .eq('id', tenantId)
    .single();

  if (tenantError || !tenant) throw new Error('Tenant not found');

  const plan = ((tenant as { plan?: string }).plan ?? 'free') as PlanName;
  if (!PLAN_LIMITS[plan].qrOrdering) {
    throw new Error('plan_required');
  }

  return { tenant_id: tenantId };
}
