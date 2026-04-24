import type { Category, MenuItemWithCategory } from '@gustri/database';
import {
  useCategories as useSharedCategories,
  useMenuItem as useSharedMenuItem,
  useMenuItems as useSharedMenuItems,
} from '@gustri/queries';

/**
 * Customer-web always fetches only active categories.
 */
export function useCategories(options?: { initialData?: Category[] }) {
  return useSharedCategories({ isActive: true, initialData: options?.initialData });
}

/**
 * Customer-web always fetches only available menu items,
 * with optional category filter.
 */
export function useMenuItems(
  categoryId?: string,
  options?: { initialData?: MenuItemWithCategory[] },
) {
  return useSharedMenuItems({ categoryId, isAvailable: true, initialData: options?.initialData });
}

/**
 * Re-export useMenuItem directly — same signature.
 */
export { useSharedMenuItem as useMenuItem };
