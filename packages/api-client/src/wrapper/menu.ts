/**
 * Menu items and categories wrapper module
 */

import { handleSupabaseError, isCategory, isCategoryArray, isMenuItem } from '@gustri/core';
import type {
  CategoryInsert,
  CategoryUpdate,
  MenuItemInsert,
  MenuItemRow,
  MenuItemUpdate,
  PaginatedResult,
  WrapperContext,
} from './types';

export function createMenuItemsWrapper(ctx: WrapperContext) {
  return {
    findAll: async (options?: {
      categoryId?: string;
      isAvailable?: boolean;
      isPopular?: boolean;
    }) => {
      let query = ctx.client
        .from('menu_items')
        .select(`
          *,
          category:categories(*)
        `)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true })
        .limit(500);

      if (options?.categoryId) {
        query = query.eq('category_id', options.categoryId);
      }
      if (options?.isAvailable !== undefined) {
        query = query.eq('is_available', options.isAvailable);
      }
      if (options?.isPopular !== undefined) {
        query = query.eq('is_popular', options.isPopular);
      }

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findById: async (id: string) => {
      const { data, error } = await ctx.client
        .from('menu_items')
        .select(`
          *,
          category:categories(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isMenuItem(data)) throw new Error('Invalid menu item data');
      return data;
    },

    update: async (id: string, updates: Partial<MenuItemUpdate>) => {
      const { data, error } = await ctx.anyClient
        .from('menu_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isMenuItem(data)) throw new Error('Invalid menu item data');
      return data;
    },

    create: async (itemData: MenuItemInsert) => {
      const { data, error } = await ctx.anyClient
        .from('menu_items')
        .insert(itemData)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isMenuItem(data)) throw new Error('Invalid menu item data');
      return data;
    },

    toggleAvailability: async (id: string, currentAvailable: boolean) => {
      const { data, error } = await ctx.anyClient
        .from('menu_items')
        .update({ is_available: !currentAvailable })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isMenuItem(data)) throw new Error('Invalid menu item data');
      return data;
    },

    delete: async (id: string) => {
      const { error } = await ctx.anyClient.from('menu_items').delete().eq('id', id);

      if (error) throw handleSupabaseError(error);
    },

    findAllPaginated: async (options?: {
      page?: number;
      pageSize?: number;
      categoryId?: string;
      isAvailable?: boolean;
    }): Promise<PaginatedResult<MenuItemRow>> => {
      const page = options?.page ?? 1;
      const pageSize = options?.pageSize ?? 100;
      const offset = (page - 1) * pageSize;

      let query = ctx.client
        .from('menu_items')
        .select('*, category:categories(*)', { count: 'exact' })
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (options?.categoryId) {
        query = query.eq('category_id', options.categoryId);
      }
      if (options?.isAvailable !== undefined) {
        query = query.eq('is_available', options.isAvailable);
      }

      query = query.range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;

      if (error) throw handleSupabaseError(error);
      return {
        data: (data || []) as MenuItemRow[],
        count: count ?? 0,
        hasMore: (count ?? 0) > offset + pageSize,
      };
    },
  };
}

export function createCategoriesWrapper(ctx: WrapperContext) {
  return {
    findAll: async (options?: { isActive?: boolean }) => {
      let query = ctx.client
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (options?.isActive !== undefined) {
        query = query.eq('is_active', options.isActive);
      }

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      const categories = data || [];
      if (!isCategoryArray(categories)) throw new Error('Invalid categories data');
      return categories;
    },

    create: async (categoryData: CategoryInsert) => {
      const { data, error } = await ctx.anyClient
        .from('categories')
        .insert(categoryData)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isCategory(data)) throw new Error('Invalid category data');
      return data;
    },

    update: async (id: string, updates: Partial<CategoryUpdate>) => {
      const { data, error } = await ctx.anyClient
        .from('categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isCategory(data)) throw new Error('Invalid category data');
      return data;
    },

    delete: async (id: string) => {
      const { error } = await ctx.anyClient.from('categories').delete().eq('id', id);

      if (error) throw handleSupabaseError(error);
    },
  };
}

export type MenuItemsWrapper = ReturnType<typeof createMenuItemsWrapper>;
export type CategoriesWrapper = ReturnType<typeof createCategoriesWrapper>;
