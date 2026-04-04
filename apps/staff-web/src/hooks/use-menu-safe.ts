/**
 * Type-Safe Menu Hooks
 * Uses the wrapped client for type safety without 'as any'
 */

import { QUERY_KEYS } from '@gustri/core';
import type { Database } from '@gustri/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateMenuAndCategories } from '@/lib/query-helpers';
import { db } from '@/lib/supabase/wrapped-client';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type MenuItemInsert = Database['public']['Tables']['menu_items']['Insert'];
type MenuItemUpdate = Database['public']['Tables']['menu_items']['Update'];
type Category = Database['public']['Tables']['categories']['Row'];
type CategoryInsert = Database['public']['Tables']['categories']['Insert'];
type CategoryUpdate = Database['public']['Tables']['categories']['Update'];

// Menu items hooks
export function useMenuItems(options?: {
  categoryId?: string;
  isAvailable?: boolean;
  isPopular?: boolean;
}) {
  return useQuery({
    queryKey: [QUERY_KEYS.MENU_ITEMS, options],
    queryFn: async (): Promise<MenuItem[]> => db.menuItems.findAll(options),
  });
}

export function useMenuItem(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.MENU_ITEM, id],
    queryFn: async (): Promise<MenuItem> => db.menuItems.findById(id),
    enabled: !!id,
  });
}

export function useUpdateMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<MenuItemUpdate> }) =>
      db.menuItems.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MENU_ITEMS] });
    },
  });
}

export function useCreateMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: MenuItemInsert) => db.menuItems.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MENU_ITEMS] });
    },
  });
}

export function useToggleMenuItemAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, currentAvailable }: { id: string; currentAvailable: boolean }) =>
      db.menuItems.toggleAvailability(id, currentAvailable),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MENU_ITEMS] });
    },
  });
}

export function useDeleteMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.menuItems.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MENU_ITEMS] });
    },
  });
}

// Categories hooks
export function useCategories() {
  return useQuery({
    queryKey: [QUERY_KEYS.CATEGORIES],
    queryFn: async (): Promise<Category[]> => db.categories.findAll(),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CategoryInsert) => db.categories.create(data),
    onSuccess: () => {
      invalidateMenuAndCategories(queryClient);
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CategoryUpdate> }) =>
      db.categories.update(id, updates),
    onSuccess: () => {
      invalidateMenuAndCategories(queryClient);
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.categories.delete(id),
    onSuccess: () => {
      invalidateMenuAndCategories(queryClient);
    },
  });
}
