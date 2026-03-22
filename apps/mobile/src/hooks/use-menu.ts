import { QUERY_KEYS } from '@cafe-idare/core';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/supabase';
import type { Category, MenuItem } from '@/types';

export function useMenuItems(options?: { categoryId?: string; isAvailable?: boolean }) {
  return useQuery({
    queryKey: [QUERY_KEYS.MENU_ITEMS, options],
    queryFn: async (): Promise<MenuItem[]> => {
      return await db.menuItems.findAll(options);
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: [QUERY_KEYS.CATEGORIES],
    queryFn: async (): Promise<Category[]> => {
      return await db.categories.findAll({ isActive: true });
    },
  });
}
