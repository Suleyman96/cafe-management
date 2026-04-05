/**
 * Tenants wrapper module
 */

import { handleSupabaseError } from '@gustri/core';
import type { Database } from '@gustri/database';
import type { WrapperContext } from './types';

type TenantRow = Database['public']['Tables']['tenants']['Row'];

export function createTenantsWrapper(ctx: WrapperContext) {
  return {
    getCurrent: async (): Promise<TenantRow> => {
      const { data, error } = await ctx.client
        .from('tenants')
        .select('*')
        .limit(1)
        .single();

      if (error) throw handleSupabaseError(error);
      return data;
    },

    getMonthlyOrderCount: async (): Promise<number> => {
      const { data, error } = await ctx.anyClient.rpc('get_monthly_order_count');
      if (error) throw handleSupabaseError(error);
      return data ?? 0;
    },
  };
}

export type TenantsWrapper = ReturnType<typeof createTenantsWrapper>;
