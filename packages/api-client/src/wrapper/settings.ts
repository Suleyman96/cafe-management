/**
 * Cafe settings wrapper module
 */

import { handleSupabaseError } from '@gustri/core';
import type { Database } from '@gustri/database';
import type { WrapperContext } from './types';

type CafeSettingsRow = Database['public']['Tables']['cafe_settings']['Row'];
type CafeSettingsUpdate = Database['public']['Tables']['cafe_settings']['Update'];

export function createSettingsWrapper(ctx: WrapperContext) {
  return {
    get: async (): Promise<CafeSettingsRow> => {
      // RLS scopes to current tenant; each tenant has one settings row
      const { data, error } = await ctx.client.from('cafe_settings').select('*').limit(1).single();

      if (error) throw handleSupabaseError(error);
      return data;
    },

    update: async (updates: CafeSettingsUpdate): Promise<CafeSettingsRow> => {
      // RLS scopes to current tenant; update the single settings row
      const { data, error } = await ctx.anyClient
        .from('cafe_settings')
        .update(updates)
        .select('*')
        .limit(1)
        .single();

      if (error) throw handleSupabaseError(error);
      return data as CafeSettingsRow;
    },
  };
}

export type SettingsWrapper = ReturnType<typeof createSettingsWrapper>;
