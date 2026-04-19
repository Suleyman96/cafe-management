import {
  useCategories as useSharedCategories,
  useMenuItem as useSharedMenuItem,
  useMenuItems as useSharedMenuItems,
} from '@gustri/queries';

/**
 * Customer-web always fetches only active categories.
 */
export function useCategories() {
  return useSharedCategories({ isActive: true });
}

/**
 * Customer-web always fetches only available menu items,
 * with optional category filter.
 */
export function useMenuItems(categoryId?: string) {
  return useSharedMenuItems({ categoryId, isAvailable: true });
}

/**
 * Re-export useMenuItem directly — same signature.
 */
export { useSharedMenuItem as useMenuItem };
