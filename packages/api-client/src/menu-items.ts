import { handleSupabaseError } from '@cafe-idare/core';
import type { MenuItemsInsert, MenuItemsUpdate } from '@cafe-idare/database';
import type { QueryOptions, TypedSupabaseClient } from './types';

export interface MenuItemFilters extends QueryOptions {
  categoryId?: string;
  isAvailable?: boolean;
  search?: string;
}

export async function getMenuItems(client: TypedSupabaseClient, filters?: MenuItemFilters) {
  let query = client.from('menu_items').select(`
      *,
      category:categories(*)
    `);

  if (filters?.categoryId) {
    query = query.eq('category_id', filters.categoryId);
  }

  if (filters?.isAvailable !== undefined) {
    query = query.eq('is_available', filters.isAvailable);
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  query = query.order(filters?.orderBy || 'sort_order', {
    ascending: filters?.ascending ?? true,
  });

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) throw handleSupabaseError(error);
  return data;
}

export async function getMenuItem(client: TypedSupabaseClient, id: string) {
  const { data, error } = await client
    .from('menu_items')
    .select(`
      *,
      category:categories(*)
    `)
    .eq('id', id)
    .single();

  if (error) throw handleSupabaseError(error);
  return data;
}

export async function createMenuItem(client: TypedSupabaseClient, item: MenuItemsInsert) {
  const { data, error } = await (client as any).from('menu_items').insert(item).select().single();

  if (error) throw handleSupabaseError(error);
  return data;
}

export async function updateMenuItem(
  client: TypedSupabaseClient,
  id: string,
  updates: MenuItemsUpdate,
) {
  const { data, error } = await (client as any)
    .from('menu_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw handleSupabaseError(error);
  return data;
}

export async function toggleMenuItemAvailability(client: TypedSupabaseClient, id: string) {
  const { data: current, error: fetchError } = await (client as any)
    .from('menu_items')
    .select('is_available')
    .eq('id', id)
    .single();

  if (fetchError) throw handleSupabaseError(fetchError);

  return updateMenuItem(client, id, { is_available: !current.is_available });
}

export async function deleteMenuItem(client: TypedSupabaseClient, id: string) {
  const { error } = await (client as any).from('menu_items').delete().eq('id', id);

  if (error) throw handleSupabaseError(error);
}
