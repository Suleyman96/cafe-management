import { QUERY_KEYS } from '@gustri/core';
import type { MenuItemWithCategory } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { useDb } from '../provider';

export function useMenuItems(options?: {
  categoryId?: string;
  isAvailable?: boolean;
  isPopular?: boolean;
}) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.MENU_ITEMS, options],
    queryFn: () => db.menuItems.findAll(options) as Promise<MenuItemWithCategory[]>,
  });
}

export function useMenuItem(id: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.MENU_ITEM, id],
    queryFn: () => db.menuItems.findById(id) as Promise<MenuItemWithCategory>,
    enabled: !!id,
  });
}
