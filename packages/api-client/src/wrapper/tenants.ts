/**
 * Tenants wrapper module
 */

import type { Database } from '@gustri/database/types';
import { handleSupabaseError } from '../errors';
import { rpc } from './rpc-typed';
import type { WrapperContext } from './types';

type TenantRow = Database['public']['Tables']['tenants']['Row'];

/**
 * Narrowed projection of the `tenants` row exposed to clients.
 *
 * This wrapper is the only path through which client code reads the
 * tenants table (via `useTenant` / `useTenantPlan` hooks). The whole
 * row sits in the React Query cache + Sentry breadcrumbs + browser
 * DevTools, so anything we expose here is effectively client-visible.
 *
 * Today the row only carries id/name/slug/plan/is_active/timestamps
 * — none of it sensitive. But the moment a billing column lands on
 * this table (stripe_customer_id, subscription_status, billing_email,
 * webhook_secret, …) a thoughtless `select('*')` would leak it into
 * every client cache. Enumerate columns explicitly so adding a
 * sensitive column requires a deliberate change to this query.
 *
 * Timestamps are intentionally NOT exposed — no consumer reads them
 * today; adding them on demand is cheaper than leaking by default.
 */
export type TenantPublicProfile = Pick<TenantRow, 'id' | 'name' | 'slug' | 'plan' | 'is_active'>;

const TENANT_PUBLIC_COLUMNS = 'id, name, slug, plan, is_active' as const;

export function createTenantsWrapper(ctx: WrapperContext) {
  return {
    getCurrent: async (): Promise<TenantPublicProfile> => {
      // Use `id` rather than `tenant_id` — the tenants table is keyed by `id`
      // and the wrapper's tenantId IS that primary key. The applyTenantScope
      // default uses tenant_id, so query by id explicitly here and skip the
      // helper. RLS still scopes correctly.
      let query = ctx.client.from('tenants').select(TENANT_PUBLIC_COLUMNS);

      // L11 — when a tenant is bound, filter explicitly by id (defense-in-depth
      // on top of RLS). Stays correct when unbound (RLS remains the backstop).
      const tenantId = ctx.tenantContext?.tenantId ?? null;
      if (tenantId) {
        query = query.eq('id', tenantId);
      }

      const { data, error } = await query.limit(1).single();

      if (error) throw handleSupabaseError(error);
      return data;
    },

    getMonthlyOrderCount: async (): Promise<number> => {
      const data = await rpc(ctx, 'get_monthly_order_count');
      return data ?? 0;
    },
  };
}

export type TenantsWrapper = ReturnType<typeof createTenantsWrapper>;
