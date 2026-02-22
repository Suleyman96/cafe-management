import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/supabase';
import type { Category, MenuItemWithCategory } from '@/types';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const data = await db.categories.findAll({ isActive: true });
      return data as Category[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useMenuItems(categoryId?: string) {
  return useQuery({
    queryKey: ['menu_items', categoryId],
    queryFn: async () => {
      const data = await db.menuItems.findAll({
        categoryId,
        isAvailable: true,
      });
      return data as MenuItemWithCategory[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useMenuItem(itemId: string) {
  return useQuery({
    queryKey: ['menu_item', itemId],
    queryFn: async () => {
      const data = await db.menuItems.findById(itemId);
      return data as MenuItemWithCategory;
    },
    staleTime: 1000 * 60 * 5,
  });
}
