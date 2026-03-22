import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, STALE_TIMES } from '@/lib/query-keys';
import { db } from '@/lib/supabase';
import type { Category, MenuItemWithCategory } from '@/types';

export function useCategories() {
  return useQuery({
    queryKey: [QUERY_KEYS.CATEGORIES],
    queryFn: async () => {
      const data = await db.categories.findAll({ isActive: true });
      return data as Category[];
    },
    staleTime: STALE_TIMES.MEDIUM,
  });
}

export function useMenuItems(categoryId?: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.MENU_ITEMS, categoryId],
    queryFn: async () => {
      const data = await db.menuItems.findAll({
        categoryId,
        isAvailable: true,
      });
      return data as MenuItemWithCategory[];
    },
    staleTime: STALE_TIMES.MEDIUM,
  });
}

export function useMenuItem(itemId: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.MENU_ITEM, itemId],
    queryFn: async () => {
      const data = await db.menuItems.findById(itemId);
      return data as MenuItemWithCategory;
    },
    staleTime: STALE_TIMES.MEDIUM,
  });
}
