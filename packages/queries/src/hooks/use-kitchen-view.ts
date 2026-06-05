/**
 * Kitchen view derivation.
 *
 * Composes the unmodified shared `useOrders` cache with `useStaffKitchenFilters`
 * and `useCategories` to produce a station-specific view:
 *
 *   - `visibleOrders`: orders that contain at least one visible item; each
 *     order's `visibleItems` is the subset matching the staff's category
 *     filter, plus a `hiddenByCategory` summary so the UI can render
 *     "+2 items at other stations" coordination cues.
 *   - `activeFilter`: discriminated union — `'all'` when no filter is set,
 *     `'filtered'` with the resolved category names otherwise.
 *
 * Why client-side derivation, not a server-filtered query: the kitchen
 * needs to know about items it's *not* showing (the hidden-item indicator
 * is a hard product requirement). A server-filtered query would force a
 * second round trip to compute that count. Deriving over the existing
 * cache costs one `useMemo` and gives every station the indicator for
 * free, while keeping the orders cache unified across kitchen devices.
 *
 * Uncategorized items (`category_id === null` — happens when the source
 * menu item lost its category, or when a category was hard-deleted) are
 * **hidden** by filtered stations and **visible** on unfiltered stations.
 * The "show all" mode is the safety net; filtered stations are the
 * intentional opt-in. Uncategorized items still count toward the
 * `hiddenByCategory` summary under a synthetic "uncategorized" bucket so
 * the kitchen lead sees they exist and can fix the menu config.
 */

import type { Category, OrderItemWithMenuItem, OrderWithDetails } from '@gustri/database/types';
import { useMemo } from 'react';
import { useCategories } from './use-categories';
import { useOrders } from './use-orders';
import { useStaffKitchenFilters } from './use-staff-kitchen-filters';

export interface KitchenOrderView extends OrderWithDetails {
  visibleItems: OrderItemWithMenuItem[];
  hiddenItems: OrderItemWithMenuItem[];
  hiddenCount: number;
  hiddenByCategory: HiddenCategoryBucket[];
}

export interface HiddenCategoryBucket {
  /** `null` = uncategorized (item lost its category snapshot). */
  categoryId: string | null;
  categoryName: string | null;
  count: number;
}

export type ActiveKitchenFilter =
  | { mode: 'all' }
  | { mode: 'filtered'; categoryIds: string[]; names: string[] };

interface UseKitchenViewOptions {
  /** Mirrors `useOrders` — defaults to the active-kitchen status set. */
  statuses?: OrderWithDetails['status'][];
  limit?: number;
  enabled?: boolean;
}

const DEFAULT_KITCHEN_STATUSES: OrderWithDetails['status'][] = [
  'pending_approval',
  'new',
  'preparing',
  'ready',
];

export function useKitchenView(
  staffId: string | null | undefined,
  options?: UseKitchenViewOptions,
) {
  const ordersQuery = useOrders({
    statuses: options?.statuses ?? DEFAULT_KITCHEN_STATUSES,
    limit: options?.limit ?? 100,
    enabled: options?.enabled ?? true,
  });
  const filtersQuery = useStaffKitchenFilters(staffId, { enabled: options?.enabled ?? true });
  const categoriesQuery = useCategories({ enabled: options?.enabled ?? true });

  const view = useMemo(
    () =>
      deriveKitchenView({
        orders: ordersQuery.data ?? [],
        filterCategoryIds: filtersQuery.data,
        categories: categoriesQuery.data ?? [],
      }),
    [ordersQuery.data, filtersQuery.data, categoriesQuery.data],
  );

  return {
    ...view,
    isLoading: ordersQuery.isLoading || filtersQuery.isLoading || categoriesQuery.isLoading,
    isError: ordersQuery.isError || filtersQuery.isError || categoriesQuery.isError,
    error: ordersQuery.error ?? filtersQuery.error ?? categoriesQuery.error,
  };
}

/**
 * Pure derivation — exported separately so unit tests can exercise the
 * filter logic without standing up React or the query client.
 */
export function deriveKitchenView(input: {
  orders: OrderWithDetails[];
  filterCategoryIds: string[] | null | undefined;
  categories: Category[];
}): { visibleOrders: KitchenOrderView[]; activeFilter: ActiveKitchenFilter } {
  const { orders, filterCategoryIds, categories } = input;

  const filterSet =
    filterCategoryIds && filterCategoryIds.length > 0 ? new Set(filterCategoryIds) : null;

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name] as const));

  const activeFilter: ActiveKitchenFilter = filterSet
    ? {
        mode: 'filtered',
        categoryIds: [...filterSet],
        // Preserve the order the staff selected categories in (filterCategoryIds
        // arrives sorted by created_at from the wrapper). Unknown ids fall
        // through with their id as the label so a deleted-but-still-cached
        // category doesn't render as `undefined`.
        names: [...filterSet].map((id) => categoryNameById.get(id) ?? id),
      }
    : { mode: 'all' };

  const visibleOrders: KitchenOrderView[] = [];

  for (const order of orders) {
    const visibleItems: OrderItemWithMenuItem[] = [];
    const hiddenItems: OrderItemWithMenuItem[] = [];

    if (filterSet === null) {
      // Show-all mode: every item is visible. Skip the per-item branch.
      visibleItems.push(...order.order_items);
    } else {
      for (const item of order.order_items) {
        // Uncategorized items are hidden by filtered stations — see file
        // header for rationale. They surface in the hidden-by-category
        // summary under a `null` bucket.
        if (item.category_id !== null && filterSet.has(item.category_id)) {
          visibleItems.push(item);
        } else {
          hiddenItems.push(item);
        }
      }
    }

    if (visibleItems.length === 0) continue;

    visibleOrders.push({
      ...order,
      visibleItems,
      hiddenItems,
      hiddenCount: hiddenItems.length,
      hiddenByCategory: groupHiddenByCategory(hiddenItems, categoryNameById),
    });
  }

  return { visibleOrders, activeFilter };
}

function groupHiddenByCategory(
  hiddenItems: OrderItemWithMenuItem[],
  categoryNameById: Map<string, string>,
): HiddenCategoryBucket[] {
  if (hiddenItems.length === 0) return [];
  const buckets = new Map<string | null, HiddenCategoryBucket>();
  for (const item of hiddenItems) {
    const id = item.category_id ?? null;
    const existing = buckets.get(id);
    if (existing) {
      existing.count += 1;
    } else {
      buckets.set(id, {
        categoryId: id,
        categoryName: id === null ? null : (categoryNameById.get(id) ?? null),
        count: 1,
      });
    }
  }
  return [...buckets.values()];
}
