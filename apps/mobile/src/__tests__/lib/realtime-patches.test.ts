/**
 * Audit C5 — `patchOrderItemUpdate` writes a Realtime UPDATE payload
 * directly into any cached `[QUERY_KEYS.ORDERS, ...]` entry, eliminating
 * the broad invalidate-and-refetch that previously fired per item event.
 *
 * `@sentry/react-native` is mocked locally with `vi.fn()` so the
 * "captures to Sentry on schema mismatch" assertion can read call
 * counts. The global mock-sentry helper exports plain `noop`s, which
 * vitest can't assert against.
 */

import { QUERY_KEYS } from '@gustri/queries';
import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/react-native', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

import * as Sentry from '@sentry/react-native';
import { patchOrderItemUpdate } from '@/lib/realtime-patches';
import type { OrderWithDetails } from '@/types';

function makeOrder(overrides: Partial<OrderWithDetails> = {}): OrderWithDetails {
  return {
    id: '00000000-0000-0000-0000-000000000010',
    tenant_id: 'tenant-1',
    table_id: 'table-1',
    status: 'preparing',
    order_type: 'dine_in',
    source: 'waiter',
    order_number: 'A-1',
    subtotal: 0,
    tax: 0,
    total: 0,
    created_at: '2026-05-08T10:00:00Z',
    updated_at: '2026-05-08T10:00:00Z',
    table: { table_number: '1', location: null },
    order_items: [
      {
        id: '00000000-0000-0000-0000-000000000001',
        order_id: '00000000-0000-0000-0000-000000000010',
        menu_item_id: 'menu-1',
        item_name: 'Tomato Soup',
        item_price: 12,
        quantity: 1,
        notes: null,
        status: 'pending',
        created_at: '2026-05-08T10:00:00Z',
        updated_at: '2026-05-08T10:00:00Z',
        menu_item: {
          id: 'menu-1',
          name: 'Tomato Soup',
          price: 12,
        } as OrderWithDetails['order_items'][number]['menu_item'],
      } as OrderWithDetails['order_items'][number],
    ],
    ...overrides,
  } as OrderWithDetails;
}

describe('patchOrderItemUpdate', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.clearAllMocks();
  });

  it('updates the matching item status in the cached orders list', () => {
    const order = makeOrder();
    queryClient.setQueryData<OrderWithDetails[]>([QUERY_KEYS.ORDERS, undefined], [order]);

    patchOrderItemUpdate(queryClient, {
      id: '00000000-0000-0000-0000-000000000001',
      order_id: '00000000-0000-0000-0000-000000000010',
      status: 'preparing',
    });

    const next = queryClient.getQueryData<OrderWithDetails[]>([QUERY_KEYS.ORDERS, undefined]);
    expect(next?.[0]?.order_items[0]?.status).toBe('preparing');
  });

  it('preserves the cached menu_item join — Realtime payload does not carry it', () => {
    const order = makeOrder();
    queryClient.setQueryData<OrderWithDetails[]>([QUERY_KEYS.ORDERS, undefined], [order]);

    patchOrderItemUpdate(queryClient, {
      id: '00000000-0000-0000-0000-000000000001',
      order_id: '00000000-0000-0000-0000-000000000010',
      status: 'ready',
    });

    const next = queryClient.getQueryData<OrderWithDetails[]>([QUERY_KEYS.ORDERS, undefined]);
    expect(next?.[0]?.order_items[0]?.menu_item).toEqual(order.order_items[0]?.menu_item);
  });

  it('broadcasts the patch to multiple cache entries (different filter keys)', () => {
    // Two filtered lists: kitchen view and a single-table view both contain
    // the same order. A single Realtime event should patch both without
    // duplicating logic at the call site.
    const order = makeOrder();
    queryClient.setQueryData<OrderWithDetails[]>(
      [QUERY_KEYS.ORDERS, { statuses: ['pending', 'preparing', 'ready'] }],
      [order],
    );
    queryClient.setQueryData<OrderWithDetails[]>(
      [QUERY_KEYS.ORDERS, { table_id: 'table-1' }],
      [order],
    );

    patchOrderItemUpdate(queryClient, {
      id: '00000000-0000-0000-0000-000000000001',
      order_id: '00000000-0000-0000-0000-000000000010',
      status: 'preparing',
    });

    const kitchen = queryClient.getQueryData<OrderWithDetails[]>([
      QUERY_KEYS.ORDERS,
      { statuses: ['pending', 'preparing', 'ready'] },
    ]);
    const byTable = queryClient.getQueryData<OrderWithDetails[]>([
      QUERY_KEYS.ORDERS,
      { table_id: 'table-1' },
    ]);
    expect(kitchen?.[0]?.order_items[0]?.status).toBe('preparing');
    expect(byTable?.[0]?.order_items[0]?.status).toBe('preparing');
  });

  it('returns a new order object only when an item was actually patched (preserves referential equality otherwise)', () => {
    // FlashList re-renders if the row reference changes. Patching an item
    // in order A must NOT produce a new reference for order B in the same
    // list — that would force unnecessary re-renders of every kitchen card.
    const orderA = makeOrder({ id: '00000000-0000-0000-0000-00000000000a' });
    const orderB = makeOrder({ id: '00000000-0000-0000-0000-00000000000b', order_items: [] });
    queryClient.setQueryData<OrderWithDetails[]>([QUERY_KEYS.ORDERS, undefined], [orderA, orderB]);

    patchOrderItemUpdate(queryClient, {
      id: '00000000-0000-0000-0000-000000000001',
      order_id: '00000000-0000-0000-0000-00000000000a',
      status: 'preparing',
    });

    const next = queryClient.getQueryData<OrderWithDetails[]>([QUERY_KEYS.ORDERS, undefined]);
    expect(next?.[1]).toBe(orderB); // same reference — orderB was not touched
    expect(next?.[0]).not.toBe(orderA); // patched — new reference
  });

  it('is a silent no-op when no cached order matches order_id', () => {
    const order = makeOrder();
    queryClient.setQueryData<OrderWithDetails[]>([QUERY_KEYS.ORDERS, undefined], [order]);

    patchOrderItemUpdate(queryClient, {
      id: '00000000-0000-0000-0000-000000000099',
      order_id: '00000000-0000-0000-0000-000000000099',
      status: 'preparing',
    });

    const next = queryClient.getQueryData<OrderWithDetails[]>([QUERY_KEYS.ORDERS, undefined]);
    // Nothing was patched: the order in the list is the same reference,
    // and its only item is still in the original 'pending' status.
    expect(next?.[0]).toBe(order);
    expect(next?.[0]?.order_items[0]?.status).toBe('pending');
  });

  it('is a silent no-op when the order is cached but the item id is unknown', () => {
    // Race scenario: INSERT event hasn't been processed yet, so the new
    // item isn't in the cache. The UPDATE patch should drop silently —
    // the pending INSERT-triggered invalidation will sync shortly.
    const order = makeOrder();
    queryClient.setQueryData<OrderWithDetails[]>([QUERY_KEYS.ORDERS, undefined], [order]);

    patchOrderItemUpdate(queryClient, {
      id: '00000000-0000-0000-0000-000000000999',
      order_id: '00000000-0000-0000-0000-000000000010',
      status: 'preparing',
    });

    const next = queryClient.getQueryData<OrderWithDetails[]>([QUERY_KEYS.ORDERS, undefined]);
    expect(next?.[0]?.order_items[0]?.status).toBe('pending');
  });

  it('captures the Zod error to Sentry on payload shape drift', () => {
    queryClient.setQueryData<OrderWithDetails[]>([QUERY_KEYS.ORDERS, undefined], [makeOrder()]);

    patchOrderItemUpdate(queryClient, {
      // Missing required `id` and `order_id` — schema parse fails.
      status: 'preparing',
    });

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(vi.mocked(Sentry.captureException).mock.calls[0][1]).toMatchObject({
      tags: { area: 'realtime.order_items.update.patch' },
    });
  });
});
