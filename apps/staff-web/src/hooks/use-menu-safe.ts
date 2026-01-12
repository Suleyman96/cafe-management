/**
 * Type-Safe Menu Hooks
 * Uses the wrapped client for type safety without 'as any'
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';
import { QUERY_KEYS } from '@cafe-idare/core';
import type { Database } from '@cafe-idare/database';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type MenuItemInsert = Database['public']['Tables']['menu_items']['Insert'];
type CategoryInsert = Database['public']['Tables']['categories']['Insert'];

// Menu items with category relation
type MenuItemWithCategory = MenuItem & {
  category?: Category;
};

// Menu items hooks
export function useMenuItems(options?: { 
  categoryId?: string; 
  isAvailable?: boolean;
  isPopular?: boolean;
}) {
  return useQuery({
    queryKey: [QUERY_KEYS.MENU_ITEMS, options],
    queryFn: () => db.menuItems.findAll(options),
  });
}

export function useMenuItem(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.MENU_ITEM, id],
    queryFn: () => db.menuItems.findById(id),
    enabled: !!id,
  });
}

export function useUpdateMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<MenuItem> }) => 
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
    mutationFn: (id: string) => db.menuItems.toggleAvailability(id),
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
    queryFn: () => db.categories.findAll(),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CategoryInsert) => db.categories.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CATEGORIES] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Category> }) =>
      db.categories.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CATEGORIES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MENU_ITEMS] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.categories.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CATEGORIES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MENU_ITEMS] });
    },
  });
}

// Helper function to group menu items by category
export function useMenuItemsByCategory() {
  const { data: menuItems, ...rest } = useMenuItems();
  const { data: categories } = useCategories();

  const groupedItems = menuItems?.reduce((acc: Record<string, MenuItemWithCategory[]>, item: MenuItemWithCategory) => {
    const categoryId = item.category_id || 'uncategorized';
    if (!acc[categoryId]) {
      acc[categoryId] = [];
    }
    acc[categoryId].push(item);
    return acc;
  }, {} as Record<string, MenuItemWithCategory[]>);

  return {
    ...rest,
    data: {
      categories: categories || [],
      groupedItems: groupedItems || {},
      uncategorizedItems: groupedItems?.uncategorized || []
    }
  };
}