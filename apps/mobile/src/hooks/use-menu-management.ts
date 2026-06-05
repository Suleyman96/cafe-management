import type { CategoriesUpdate, MenuItemsUpdate } from '@gustri/database/types';
import { QUERY_KEYS, tenantKey, useDb, useTenantId } from '@gustri/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MUTATION_KEYS } from '@/lib/mutation-keys';

// Re-export mutations with matching param shapes
export {
  useCreateCategory,
  useCreateMenuItem,
  useDeleteCategory,
  useDeleteMenuItem,
  useToggleMenuItemAvailability,
} from '@gustri/queries';

// Local mutations — mobile consumers use { id, data } instead of { id, updates }

export function useUpdateMenuItem() {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: MUTATION_KEYS.UPDATE_MENU_ITEM,
    mutationFn: ({ id, data }: { id: string; data: MenuItemsUpdate }) =>
      db.menuItems.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.MENU_ITEMS) });
    },
  });
}

export function useUpdateCategory() {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: MUTATION_KEYS.UPDATE_CATEGORY,
    mutationFn: ({ id, data }: { id: string; data: CategoriesUpdate }) =>
      db.categories.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.MENU_ITEMS) });
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.CATEGORIES) });
    },
  });
}
