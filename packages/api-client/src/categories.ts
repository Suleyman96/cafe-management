import { TypedSupabaseClient } from './types';
import { handleSupabaseError } from '@cafe-idare/core';
import type { CategoriesInsert, CategoriesUpdate } from '@cafe-idare/database';

export async function getCategories(
  client: TypedSupabaseClient
) {
  const { data, error } = await client
    .from('categories')
    .select('*')
    .order('sort_order');
    
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function getCategory(
  client: TypedSupabaseClient,
  id: string
) {
  const { data, error } = await client
    .from('categories')
    .select('*')
    .eq('id', id)
    .single();
    
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function createCategory(
  client: TypedSupabaseClient,
  category: CategoriesInsert
) {
  const { data, error } = await (client as any)
    .from('categories')
    .insert(category)
    .select()
    .single();
    
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function updateCategory(
  client: TypedSupabaseClient,
  id: string,
  updates: CategoriesUpdate
) {
  const { data, error } = await (client as any)
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
    
  if (error) throw handleSupabaseError(error);
  return data;
}

export async function deleteCategory(
  client: TypedSupabaseClient,
  id: string
) {
  const { error } = await (client as any)
    .from('categories')
    .delete()
    .eq('id', id);
    
  if (error) throw handleSupabaseError(error);
}

export async function getCategoriesWithItemCount(
  client: TypedSupabaseClient
) {
  const { data, error } = await (client as any)
    .from('categories')
    .select(`
      *,
      menu_items(count)
    `)
    .order('sort_order');
    
  if (error) throw handleSupabaseError(error);
  
  return data.map((category: any) => ({
    ...category,
    itemCount: category.menu_items?.[0]?.count || 0
  }));
}