import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/supabase';

export function useMenuItems(options?: { categoryId?: string; isAvailable?: boolean }) {
  return useQuery({
    queryKey: ['menu_items', options],
    queryFn: async () => {
      return await db.menuItems.findAll(options);
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      return await db.categories.findAll({ isActive: true });
    },
  });
}
