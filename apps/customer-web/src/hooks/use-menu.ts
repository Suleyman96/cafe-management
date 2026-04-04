import { QUERY_KEYS } from '@gustri/core';
import { useQuery } from '@tanstack/react-query';
import { STALE_TIMES } from '@/lib/query-keys';
import { db } from '@/lib/supabase';
import type { Category, MenuItemWithCategory } from '@/types';

export function useCategories() {
  return useQuery({
    queryKey: [QUERY_KEYS.CATEGORIES],
    queryFn: async (): Promise<Category[]> => db.categories.findAll({ isActive: true }),
    staleTime: STALE_TIMES.MEDIUM,
  });
}

export function useMenuItems(categoryId?: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.MENU_ITEMS, categoryId],
    queryFn: async (): Promise<MenuItemWithCategory[]> =>
      db.menuItems.findAll({
        categoryId,
        isAvailable: true,
      }),
    staleTime: STALE_TIMES.MEDIUM,
  });
}

export function useMenuItem(itemId: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.MENU_ITEM, itemId],
    queryFn: async (): Promise<MenuItemWithCategory> =>
      db.menuItems.findById(itemId) as Promise<MenuItemWithCategory>,
    enabled: !!itemId,
    staleTime: STALE_TIMES.MEDIUM,
  });
}
