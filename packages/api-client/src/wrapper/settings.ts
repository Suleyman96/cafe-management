/**
 * Cafe settings wrapper module
 */

import { handleSupabaseError } from '@gustri/core';
import type { Database } from '@gustri/database';
import type { WrapperContext } from './types';

type CafeSettingsRow = Database['public']['Tables']['cafe_settings']['Row'];
type CafeSettingsUpdate = Database['public']['Tables']['cafe_settings']['Update'];

// The single row ID for cafe settings
const SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

export function createSettingsWrapper(ctx: WrapperContext) {
  return {
    get: async (): Promise<CafeSettingsRow> => {
      const { data, error } = await ctx.client
        .from('cafe_settings')
        .select('*')
        .eq('id', SETTINGS_ID)
        .single();

      if (error) throw handleSupabaseError(error);
      return data;
    },

    update: async (updates: CafeSettingsUpdate): Promise<CafeSettingsRow> => {
      const { data, error } = await ctx.anyClient
        .from('cafe_settings')
        .update(updates)
        .eq('id', SETTINGS_ID)
        .select('*')
        .single();

      if (error) throw handleSupabaseError(error);
      return data as CafeSettingsRow;
    },
  };
}

export type SettingsWrapper = ReturnType<typeof createSettingsWrapper>;
