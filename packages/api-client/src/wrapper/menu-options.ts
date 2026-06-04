/**
 * Menu item modifiers wrapper — option groups + their values.
 *
 * Option groups (`menu_item_options`) and values (`menu_item_option_values`)
 * are tenant-scoped catalog data: publicly readable (customers browse modifiers
 * while ordering) and admin/owner-managed. Reads use `allowNull` tenant scope
 * because anon QR browsing hits them before `set_table_context()` runs —
 * mirrors the menu_items wrapper.
 */

import { handleSupabaseError } from '../errors';
import { applyTenantScope, assertInsertTenantMatches } from './_tenant-scope';
import type {
  MenuItemOptionInsert,
  MenuItemOptionRow,
  MenuItemOptionUpdate,
  MenuItemOptionValueInsert,
  MenuItemOptionValueRow,
  MenuItemOptionValueUpdate,
  WrapperContext,
} from './types';

/** An option group with its selectable values nested (read shape). */
export type MenuItemOptionWithValues = MenuItemOptionRow & {
  values: MenuItemOptionValueRow[];
};

export function createMenuItemOptionsWrapper(ctx: WrapperContext) {
  return {
    /** All option groups (with values) for a menu item, display-ordered. */
    findByMenuItem: async (menuItemId: string): Promise<MenuItemOptionWithValues[]> => {
      const { data, error } = await applyTenantScope(
        ctx.client
          .from('menu_item_options')
          .select(`
            *,
            values:menu_item_option_values(*)
          `)
          .eq('menu_item_id', menuItemId)
          .order('display_order', { ascending: true }),
        ctx,
        { allowNull: true },
      );

      if (error) throw handleSupabaseError(error);
      return (data ?? []) as MenuItemOptionWithValues[];
    },

    createOption: async (optionData: MenuItemOptionInsert): Promise<MenuItemOptionRow> => {
      assertInsertTenantMatches(optionData, ctx);
      const { data, error } = await ctx.anyClient
        .from('menu_item_options')
        .insert(optionData)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      return data as MenuItemOptionRow;
    },

    updateOption: async (
      id: string,
      updates: Partial<MenuItemOptionUpdate>,
    ): Promise<MenuItemOptionRow> => {
      const { data, error } = await ctx.anyClient
        .from('menu_item_options')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      return data as MenuItemOptionRow;
    },

    deleteOption: async (id: string): Promise<void> => {
      const { error } = await ctx.anyClient.from('menu_item_options').delete().eq('id', id);
      if (error) throw handleSupabaseError(error);
    },

    createValue: async (valueData: MenuItemOptionValueInsert): Promise<MenuItemOptionValueRow> => {
      assertInsertTenantMatches(valueData, ctx);
      const { data, error } = await ctx.anyClient
        .from('menu_item_option_values')
        .insert(valueData)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      return data as MenuItemOptionValueRow;
    },

    updateValue: async (
      id: string,
      updates: Partial<MenuItemOptionValueUpdate>,
    ): Promise<MenuItemOptionValueRow> => {
      const { data, error } = await ctx.anyClient
        .from('menu_item_option_values')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      return data as MenuItemOptionValueRow;
    },

    deleteValue: async (id: string): Promise<void> => {
      const { error } = await ctx.anyClient.from('menu_item_option_values').delete().eq('id', id);
      if (error) throw handleSupabaseError(error);
    },
  };
}

export type MenuItemOptionsWrapper = ReturnType<typeof createMenuItemOptionsWrapper>;
