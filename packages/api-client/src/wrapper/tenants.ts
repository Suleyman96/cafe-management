/**
 * Tenants wrapper module
 *
 * After migration 20260501000002, authenticated callers cannot SELECT from
 * `public.tenants` directly — column-level leak (M4). The wrapper reads from
 * `public.tenant_self_view` (id, name, slug only) and exposes the plan via
 * the SECURITY-DEFINER RPC `get_my_tenant_plan` for callers that need it
 * (post-login plan-gate, billing UI). Admin/billing flows that need
 * `is_active` or other restricted columns must go through service-role
 * routes, not this wrapper.
 */

import type { Database } from '@gustri/database';
import { handleSupabaseError } from '../errors';
import { rpc } from './rpc-typed';
import type { WrapperContext } from './types';

type TenantSelfRow = Database['public']['Views']['tenant_self_view']['Row'];

export type TenantSelf = {
  id: string;
  name: string;
  slug: string;
};

function assertNonNull(row: TenantSelfRow): TenantSelf {
  if (!row.id || !row.name || !row.slug) {
    throw new Error('Invalid tenant_self_view row');
  }
  return { id: row.id, name: row.name, slug: row.slug };
}

export function createTenantsWrapper(ctx: WrapperContext) {
  return {
    /**
     * Returns the calling user's tenant — id, name, slug only. For the
     * plan, call `getCurrentPlan()`. For other columns (`is_active`,
     * billing/audit fields), use a service-role route.
     */
    getCurrent: async (): Promise<TenantSelf> => {
      const { data, error } = await ctx.client
        .from('tenant_self_view')
        .select('*')
        .limit(1)
        .single();

      if (error) throw handleSupabaseError(error);
      return assertNonNull(data);
    },

    /**
     * Returns the calling user's tenant plan ('free' | 'standard' | 'pro' |
     * 'business') via the SECURITY-DEFINER RPC. Resolves the tenant from
     * the JWT (staff) or `app.current_tenant_id` GUC (anon QR).
     */
    getCurrentPlan: async (): Promise<string | null> => {
      const data = await rpc(ctx, 'get_my_tenant_plan');
      return data ?? null;
    },

    getMonthlyOrderCount: async (): Promise<number> => {
      const data = await rpc(ctx, 'get_monthly_order_count');
      return data ?? 0;
    },
  };
}

export type TenantsWrapper = ReturnType<typeof createTenantsWrapper>;
