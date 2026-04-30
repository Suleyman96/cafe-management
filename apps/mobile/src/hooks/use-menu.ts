import { useMenuItems, useCategories as useSharedCategories } from '@gustri/queries';

export { useMenuItems };

/**
 * Wraps `@gustri/queries.useCategories` with `isActive: true` pre-applied.
 * Mobile only ever surfaces active categories — staff-web does the
 * activate/deactivate management and passes the filter explicitly.
 */
export function useCategories() {
  return useSharedCategories({ isActive: true });
}
