import { QUERY_KEYS } from '@gustri/core';
import type { CategoriesUpdate, MenuItemsUpdate } from '@gustri/database';
import { useDb } from '@gustri/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MenuItemsUpdate }) =>
      db.menuItems.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MENU_ITEMS] });
    },
  });
}

export function useUpdateCategory() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CategoriesUpdate }) =>
      db.categories.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MENU_ITEMS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CATEGORIES] });
    },
  });
}
