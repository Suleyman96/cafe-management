import { useMenuItems, useCategories as useSharedCategories } from '@gustri/queries';

export { useMenuItems };

export function useCategories() {
  return useSharedCategories({ isActive: true });
}
