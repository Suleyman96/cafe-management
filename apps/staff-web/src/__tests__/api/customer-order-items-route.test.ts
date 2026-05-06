/**
 * Route-level test for `/api/v1/customer/orders/[id]/items` length caps (H3).
 *
 * Same pattern as `customer-orders-route.test.ts`: mock the service layer
 * and exercise the schema gate. Postgres CHECK constraints in
 * 20260507000001 cover the direct-Supabase path that bypasses this route.
 */

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/verify-admin', () => ({
  getSupabaseAdmin: () => ({}),
}));

vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 999, resetAt: 0 }),
  getRateLimitIdentifier: () => '127.0.0.1',
}));

const addCustomerOrderItemsMock = vi.fn();
vi.mock('@/lib/services/customer-order-service', () => ({
  addCustomerOrderItems: (...args: unknown[]) => addCustomerOrderItemsMock(...args),
}));

const { POST } = await import('@/app/api/v1/customer/orders/[id]/items/route');

const ORDER_ID = '22222222-2222-4222-8222-222222222222';
const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const MENU_ITEM_ID = '33333333-3333-4333-8333-333333333333';
const CLIENT_REQ_ID = '55555555-5555-4555-8555-555555555555';

function buildRequest(body: Record<string, unknown>): NextRequest {
  return {
    headers: { get: () => null },
    json: async () => body,
  } as unknown as NextRequest;
}

const params = Promise.resolve({ id: ORDER_ID });

const baseItem = {
  menu_item_id: MENU_ITEM_ID,
  item_name: 'Coffee',
  item_price: 5,
  quantity: 1,
  tenant_id: TENANT_ID,
  client_request_id: CLIENT_REQ_ID,
};

beforeEach(() => {
  addCustomerOrderItemsMock.mockReset();
});

describe('POST /api/v1/customer/orders/[id]/items — length caps (H3)', () => {
  it('rejects items array exceeding 50 entries', async () => {
    const items = Array.from({ length: 51 }, () => ({ ...baseItem }));

    const res = await POST(buildRequest({ items }), { params });

    expect(res.status).toBe(400);
    expect(addCustomerOrderItemsMock).not.toHaveBeenCalled();
  });

  it('rejects an item with notes exceeding 500 chars', async () => {
    const res = await POST(
      buildRequest({
        items: [{ ...baseItem, notes: 'x'.repeat(501) }],
      }),
      { params },
    );

    expect(res.status).toBe(400);
    expect(addCustomerOrderItemsMock).not.toHaveBeenCalled();
  });

  it('rejects an item with item_name exceeding 200 chars', async () => {
    const res = await POST(
      buildRequest({
        items: [{ ...baseItem, item_name: 'x'.repeat(201) }],
      }),
      { params },
    );

    expect(res.status).toBe(400);
    expect(addCustomerOrderItemsMock).not.toHaveBeenCalled();
  });

  it('rejects an item with quantity exceeding 999', async () => {
    const res = await POST(
      buildRequest({
        items: [{ ...baseItem, quantity: 1000 }],
      }),
      { params },
    );

    expect(res.status).toBe(400);
    expect(addCustomerOrderItemsMock).not.toHaveBeenCalled();
  });

  it('accepts a valid item at the boundary (notes = 500, item_name = 200)', async () => {
    addCustomerOrderItemsMock.mockResolvedValue([{ id: 'i1' }]);

    const res = await POST(
      buildRequest({
        items: [
          {
            ...baseItem,
            notes: 'x'.repeat(500),
            item_name: 'x'.repeat(200),
          },
        ],
      }),
      { params },
    );

    expect(res.status).toBe(201);
    expect(addCustomerOrderItemsMock).toHaveBeenCalledTimes(1);
  });
});
