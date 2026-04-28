import type { MenuItemWithCategory } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '../keys';
import { useDb } from '../provider';

export function useMenuItems(options?: {
  categoryId?: string;
  isAvailable?: boolean;
  isPopular?: boolean;
  initialData?: MenuItemWithCategory[];
}) {
  const db = useDb();
  const initialData = options?.initialData;
  // Strip initialData from the options passed to findAll and used as query key
  let filterOptions:
    | { categoryId?: string; isAvailable?: boolean; isPopular?: boolean }
    | undefined;
  if (options) {
    const { initialData: _, ...rest } = options;
    filterOptions = Object.keys(rest).length > 0 ? rest : undefined;
  }
  return useQuery({
    queryKey: [QUERY_KEYS.MENU_ITEMS, filterOptions],
    queryFn: () => db.menuItems.findAll(filterOptions) as Promise<MenuItemWithCategory[]>,
    staleTime: 5 * 60 * 1000,
    ...(initialData ? { initialData } : {}),
  });
}

export function useMenuItemsPaginated(page: number, pageSize: number, categoryId?: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.MENU_ITEMS, 'paginated', page, pageSize, categoryId],
    queryFn: () => db.menuItems.findAllPaginated({ page, pageSize, categoryId }),
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
