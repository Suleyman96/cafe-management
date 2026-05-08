import type { OrderItemWithMenuItem, OrderWithDetails } from '@gustri/database';
import { OrderItemsRealtimeUpdateSchema } from '@gustri/database';
import { QUERY_KEYS } from '@gustri/queries';
import * as Sentry from '@sentry/react-native';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Audit C5 — apply an `order_items` UPDATE realtime payload directly to
 * any cached `[QUERY_KEYS.ORDERS, ...]` entries instead of invalidating
 * the whole orders list.
 *
 * Why patch instead of invalidate: status transitions on items
 * (`pending → preparing → ready → served`) fire frequently during a busy
 * service. The previous broad invalidation re-fetched the entire orders
 * list per event, sometimes multiple times per second on weak Wi-Fi.
 * Item status doesn't change order-level filter membership (kitchen view
 * filters by ORDER status, not item status), so updating the row in
 * place is safe and complete.
 *
 * Why this is `order_items` UPDATE only: INSERTs lack the `menu_item`
 * join we'd need to reconstruct in-cache, and DELETEs are rare enough
 * that a single refetch isn't a perf concern. `orders` UPDATEs change
 * filter membership (status transitions move orders between lists), so
 * those still go through the invalidation path. See the use-orders.ts
 * handler split for the exact contract.
 *
 * The function is a no-op when:
 *   - the payload doesn't validate (schema-shape drift) — captured to
 *     Sentry with `area: 'realtime.order_items.update.patch'` so we know
 *     when the wire shape diverges from our expectations.
 *   - no cached order matches `payload.order_id` (the order isn't in
 *     any active list this device is observing).
 *   - the matched order doesn't have the item id (race: INSERT event
 *     hasn't been processed yet). The pending INSERT-triggered
 *     invalidation will sync the cache shortly.
 */
export function patchOrderItemUpdate(
  queryClient: QueryClient,
  payload: Record<string, unknown>,
): void {
  const parsed = OrderItemsRealtimeUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    Sentry.captureException(parsed.error, {
      tags: { area: 'realtime.order_items.update.patch' },
    });
    return;
  }
  const { id, order_id } = parsed.data;

  queryClient.setQueriesData<OrderWithDetails[]>({ queryKey: [QUERY_KEYS.ORDERS] }, (old) => {
    if (!old) return old;

    let listChanged = false;
    const next = old.map((order) => {
      if (order.id !== order_id) return order;
      if (!order.order_items) return order;

      let itemChanged = false;
      const items = order.order_items.map((item): OrderItemWithMenuItem => {
        if (item.id !== id) return item;
        itemChanged = true;
        // Spread the payload onto the cached row, but keep the
        // `menu_item` join — Realtime doesn't carry joined data, and
        // dropping it would blank the item's name in the UI.
        return {
          ...item,
          ...(payload as Partial<OrderItemWithMenuItem>),
          menu_item: item.menu_item,
        };
      });

      if (!itemChanged) return order;
      listChanged = true;
      return { ...order, order_items: items };
    });

    return listChanged ? next : old;
  });
}
