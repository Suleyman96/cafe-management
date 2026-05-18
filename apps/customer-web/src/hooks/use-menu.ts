import {
  useCategories as useSharedCategories,
  useMenuItem as useSharedMenuItem,
  useMenuItems as useSharedMenuItems,
} from '@gustri/queries';
import type { Category, MenuItemWithCategory } from '@/types';

/**
 * Customer-web always fetches only active categories.
 */
export function useCategories(options?: { initialData?: Category[] }) {
  return useSharedCategories({ isActive: true, initialData: options?.initialData });
}

/**
 * Customer-web always fetches only available menu items, with optional
 * category filter and optional channel restriction.
 *
 * `isDeliverable` is opt-in (defaults to undefined → no filter): the
 * caller passes it from a delivery-context check. Hardcoding it here
 * would break the dine-in flow that shares this hook.
 */
export function useMenuItems(
  categoryId?: string,
  options?: { initialData?: MenuItemWithCategory[]; isDeliverable?: boolean },
) {
  // Conditional spread so `isDeliverable` is omitted (not set to
  // undefined) for dine-in callers. The shared hook derives its
  // queryKey from `Object.keys(options)` — an explicit `undefined`
  // entry would silently change the key for every existing dine-in
  // consumer, invalidating their cache on deploy with no behavioural
  // benefit. Only include it when the caller actually wants to filter.
  return useSharedMenuItems({
    categoryId,
    isAvailable: true,
    ...(options?.isDeliverable !== undefined ? { isDeliverable: options.isDeliverable } : {}),
    ...(options?.initialData ? { initialData: options.initialData } : {}),
  });
}

/**
 * Re-export useMenuItem directly — same signature.
 */
export { useSharedMenuItem as useMenuItem };
