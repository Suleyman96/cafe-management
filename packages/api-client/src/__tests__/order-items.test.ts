/**
 * Order-items wrapper — tenant-guard on `create`.
 *
 * `order_items.Insert.tenant_id` is an optional caller-supplied field, so a
 * buggy or malicious client could post items carrying a foreign tenant_id.
 * `create` now runs `assertInsertTenantMatches` on every item before the insert
 * (defense-in-depth on top of RLS), matching every other tenant-scoped wrapper
 * create. Items that omit tenant_id still pass through — the DB fills it from
 * the parent order.
 */

import { AuthorizationError } from '@gustri/core';
import { describe, expect, it } from 'vitest';
import { createOrderItemsWrapper } from '../wrapper/order-items';
import { createMockContext } from './helpers/mock-supabase';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

// Minimal shape that satisfies `isOrderItem` (id/order_id/menu_item_id/quantity/item_price).
const validRow = {
  id: 'oi1',
  order_id: 'o1',
  menu_item_id: 'm1',
  quantity: 1,
  item_price: 10,
  tenant_id: TENANT_A,
};

const okResponses = { responses: { order_items: { data: [validRow], error: null } } };

describe('order-items wrapper — tenant guard on create', () => {
  it('throws AuthorizationError when an item carries a foreign tenant_id', async () => {
    const ctx = createMockContext({ tenantId: TENANT_A, ...okResponses });
    const wrapper = createOrderItemsWrapper(ctx as never);

    await expect(
      wrapper.create([
        { order_id: 'o1', menu_item_id: 'm1', quantity: 1, item_price: 10, tenant_id: TENANT_B },
      ] as never),
    ).rejects.toBeInstanceOf(AuthorizationError);

    // Fails fast: the insert must never run when the guard rejects.
    expect(ctx.getCalls().some((c: { method: string }) => c.method === 'insert')).toBe(false);
  });

  it('inserts when the item tenant_id matches the bound context', async () => {
    const ctx = createMockContext({ tenantId: TENANT_A, ...okResponses });
    const wrapper = createOrderItemsWrapper(ctx as never);

    const result = await wrapper.create([
      { order_id: 'o1', menu_item_id: 'm1', quantity: 1, item_price: 10, tenant_id: TENANT_A },
    ] as never);

    expect(result).toEqual([validRow]);
    expect(ctx.getCalls().some((c: { method: string }) => c.method === 'insert')).toBe(true);
  });

  it('inserts when items omit tenant_id (DB fills it from the parent order)', async () => {
    const ctx = createMockContext({ tenantId: TENANT_A, ...okResponses });
    const wrapper = createOrderItemsWrapper(ctx as never);

    await expect(
      wrapper.create([
        { order_id: 'o1', menu_item_id: 'm1', quantity: 1, item_price: 10 },
      ] as never),
    ).resolves.toEqual([validRow]);
  });
});
