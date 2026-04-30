import type { MenuItemWithCategory } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '../keys';
import { useDb } from '../provider';

export function useMenuItems(options?: {
  categoryId?: string;
  isAvailable?: boolean;
  isPopular?: boolean;
  initialData?: MenuItemWithCategory[];
  enabled?: boolean;
}) {
  const db = useDb();
  const initialData = options?.initialData;
  const enabled = options?.enabled ?? true;
  let filterOptions:
    | { categoryId?: string; isAvailable?: boolean; isPopular?: boolean }
    | undefined;
  if (options) {
    const { initialData: _, enabled: __, ...rest } = options;
    filterOptions = Object.keys(rest).length > 0 ? rest : undefined;
  }
  return useQuery({
    queryKey: [QUERY_KEYS.MENU_ITEMS, filterOptions],
    queryFn: () => db.menuItems.findAll(filterOptions) as Promise<MenuItemWithCategory[]>,
    staleTime: 5 * 60 * 1000,
    enabled,
    ...(initialData ? { initialData } : {}),
  });
}

export function useMenuItemsPaginated(
  page: number,
  pageSize: number,
  categoryId?: string,
  options?: { enabled?: boolean },
) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.MENU_ITEMS, 'paginated', page, pageSize, categoryId],
    queryFn: () => db.menuItems.findAllPaginated({ page, pageSize, categoryId }),
    enabled: options?.enabled ?? true,
  });
}

export function useMenuItem(id: string, options?: { enabled?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.MENU_ITEM, id],
    queryFn: () => db.menuItems.findById(id) as Promise<MenuItemWithCategory>,
    enabled: !!id && (options?.enabled ?? true),
  });
}
