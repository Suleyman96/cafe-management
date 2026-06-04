import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, tenantKey } from '../keys';
import { useDb, useTenantId } from '../provider';

/**
 * Option groups (with their values) for a menu item — display-ordered.
 * Shared: staff-web admin UI manages them; customer-web reads them while
 * ordering. Return type is inferred from the wrapper (`MenuItemOptionWithValues[]`).
 */
export function useMenuItemOptions(
  menuItemId: string | undefined,
  options?: { enabled?: boolean },
) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.MENU_ITEM_OPTIONS, menuItemId),
    queryFn: () => db.menuItemOptions.findByMenuItem(menuItemId as string),
    enabled: !!menuItemId && (options?.enabled ?? true),
  });
}
