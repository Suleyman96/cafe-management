/**
 * Cafe settings wrapper module
 */

import type { Database } from '@gustri/database';
import { handleSupabaseError } from '../errors';
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
      // First get the current row's id (RLS scopes to current tenant)
      const { data: current, error: getError } = await ctx.client
        .from('cafe_settings')
        .select('id')
        .limit(1)
        .single();

      if (getError) throw handleSupabaseError(getError);

      const { data, error } = await ctx.anyClient
        .from('cafe_settings')
        .update(updates)
        .eq('id', (current as { id: string }).id)
        .select('*')
        .single();

      if (error) throw handleSupabaseError(error);
      return data as CafeSettingsRow;
    },
  };
}

export type SettingsWrapper = ReturnType<typeof createSettingsWrapper>;
