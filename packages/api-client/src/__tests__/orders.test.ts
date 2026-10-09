import { AuthenticationError, ConflictError, ValidationError } from '@gustri/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { createOrderItemsWrapper } from '../wrapper/order-items';
import { createOrdersWrapper } from '../wrapper/orders';
import {
  buildOrder,
  buildOrderInsert,
  buildOrderItem,
  buildOrderItemInsert,
  resetFactoryCounter,
} from './helpers/factories';
import { createMockContext } from './helpers/mock-supabase';

const validOrder = buildOrder({
  id: '123e4567-e89b-12d3-a456-426614174000',
  status: 'new',
  source: 'customer',
  table_id: '123e4567-e89b-12d3-a456-426614174001',
});

const validOrderItem = buildOrderItem({
  id: '123e4567-e89b-12d3-a456-426614174010',
  order_id: validOrder.id,
  menu_item_id: '123e4567-e89b-12d3-a456-426614174020',
  quantity: 2,
  item_price: 15.99,
  status: 'pending',
});

describe('OrdersWrapper', () => {
  let ctx: ReturnType<typeof createMockContext>;
  let orders: ReturnType<typeof createOrdersWrapper>;

  beforeEach(() => {
    resetFactoryCounter();
    ctx = createMockContext({
      responses: {
        orders: { data: [validOrder], error: null },
        orders_decrypted: { data: [validOrder], error: null },
      },
    });
    orders = createOrdersWrapper(ctx);
  });

  it('findAll returns orders', async () => {
    const result = await orders.findAll({ limit: 50 });
    expect(result).toEqual([validOrder]);
  });

  it('findAll applies status filter', async () => {
    await orders.findAll({ status: 'new', limit: 50 });
    const calls = ctx.getCalls();
    expect(calls[0].table).toBe('orders_decrypted');
    expect(calls[0].method).toBe('select');
  });

  it('findAll throws when no scope is supplied', async () => {
    await expect(orders.findAll()).rejects.toThrow(
      /requires either an explicit `limit` or `created_after` filter/,
    );
  });

  it('findAll allows created_after as the only scope', async () => {
    await expect(orders.findAll({ created_after: '2026-01-01T00:00:00Z' })).resolves.toEqual([
      validOrder,
    ]);
  });

  it('findById returns single order', async () => {
    const singleCtx = createMockContext({
      responses: {
        orders: { data: validOrder, error: null },
        orders_decrypted: { data: validOrder, error: null },
      },
    });
    const singleOrders = createOrdersWrapper(singleCtx);
    const result = await singleOrders.findById(validOrder.id);
    expect(result).toEqual(validOrder);
  });

  it('create inserts order data', async () => {
    const createCtx = createMockContext({
      responses: {
        orders: { data: validOrder, error: null },
      },
    });
    const createOrders = createOrdersWrapper(createCtx);
    const result = await createOrders.create(
      buildOrderInsert({
        status: 'new',
        source: 'customer',
        table_id: validOrder.table_id,
      }),
    );
    expect(result).toEqual(validOrder);
  });

  // Delivery orders accept name-only customer info after the
  // orders_takeout_customer_check relaxation in migration
  // 20260515000005. The wrapper itself must not reintroduce a
  // client-side phone/address requirement — that gate moved to the UI
  // for the QR self-service flow only (apps/staff-web/.../customer/orders).
  it('create accepts a delivery order with only customer_name', async () => {
    const deliveryOrder = {
      ...validOrder,
      order_type: 'delivery' as const,
      customer_name: 'Phone-In Customer',
      customer_phone: null,
      delivery_address: null,
      table_id: null,
    };
    const createCtx = createMockContext({
      responses: {
        orders: { data: deliveryOrder, error: null },
      },
    });
    const createOrders = createOrdersWrapper(createCtx);
    const result = await createOrders.create(
      buildOrderInsert({
        order_type: 'delivery',
        status: 'new',
        source: 'waiter',
        table_id: null,
        customer_name: 'Phone-In Customer',
        customer_phone: null,
        delivery_address: null,
      }),
    );
    expect(result.customer_name).toBe('Phone-In Customer');
    expect(result.customer_phone).toBeNull();
    expect(result.delivery_address).toBeNull();

    const insertCall = createCtx
      .getCalls()
      .find((c: { table: string; method: string; args: unknown[] }) => c.method === 'insert');
    const payload = insertCall!.args[0] as Record<string, unknown>;
    expect(payload.customer_phone).toBeNull();
    expect(payload.delivery_address).toBeNull();
  });

  // C2 — revenue-theft fix: any client-supplied totals MUST be replaced with
  // zeros at the wrapper boundary. The DB-level recompute trigger rewrites
  // them once items land, but a row with no items would otherwise persist
  // whatever the caller sent. Don't trust the wire.
  it('create overwrites client-supplied subtotal/tax/total with zeros', async () => {
    const createCtx = createMockContext({
      responses: {
        orders: { data: validOrder, error: null },
      },
    });
    const createOrders = createOrdersWrapper(createCtx);
    await createOrders.create(
      buildOrderInsert({
        status: 'new',
        source: 'customer',
        table_id: validOrder.table_id,
        // Spoofed by a malicious client — wrapper must drop these.
        subtotal: 0.01,
        tax: 0.01,
        total: 0.01,
      } as Parameters<typeof buildOrderInsert>[0] & {
        subtotal: number;
        tax: number;
        total: number;
      }),
    );
    const insertCall = createCtx
      .getCalls()
      .find((c: { table: string; method: string; args: unknown[] }) => c.method === 'insert');
    expect(insertCall).toBeDefined();
    const payload = insertCall!.args[0] as Record<string, unknown>;
    expect(payload.subtotal).toBe(0);
    expect(payload.tax).toBe(0);
    expect(payload.total).toBe(0);
  });

  it('updateStatus calls update with correct status', async () => {
    const updateCtx = createMockContext({
      responses: {
        orders: { data: { ...validOrder, status: 'preparing' }, error: null },
        order_items: { data: [{ id: 'item-1' }], error: null },
      },
    });
    const updateOrders = createOrdersWrapper(updateCtx);
    const result = await updateOrders.updateStatus(validOrder.id, 'preparing');
    expect(result.status).toBe('preparing');
  });

  // ─── M6: tenant predicate on mutations (defense-in-depth) ────────
  it('updateStatus scopes update + refetch to the bound tenant', async () => {
    const TENANT = '00000000-0000-0000-0000-00000000aaaa';
    const updateCtx = createMockContext({
      tenantId: TENANT,
      responses: {
        orders: { data: { ...validOrder, status: 'preparing' }, error: null },
        order_items: { data: [{ id: 'item-1' }], error: null },
      },
    });
    const updateOrders = createOrdersWrapper(updateCtx);
    await updateOrders.updateStatus(validOrder.id, 'preparing');
    const tenantEqs = updateCtx
      .getCalls()
      .filter(
        (c: { method: string; args: unknown[] }) =>
          c.method === 'eq' && c.args[0] === 'tenant_id' && c.args[1] === TENANT,
      );
    expect(tenantEqs.length).toBeGreaterThan(0);
  });

  it('updateNotes scopes the write to the bound tenant', async () => {
    const TENANT = '00000000-0000-0000-0000-00000000aaaa';
    const notesCtx = createMockContext({
      tenantId: TENANT,
      responses: { orders: { data: validOrder, error: null } },
    });
    const notesOrders = createOrdersWrapper(notesCtx);
    await notesOrders.updateNotes(validOrder.id, { internal_notes: 'x' });
    const tenantEqs = notesCtx
      .getCalls()
      .filter(
        (c: { method: string; args: unknown[] }) =>
          c.method === 'eq' && c.args[0] === 'tenant_id' && c.args[1] === TENANT,
      );
    expect(tenantEqs.length).toBeGreaterThan(0);
  });

  it('mutations stay unscoped when no tenant is bound (anon/legacy ctx)', async () => {
    const notesCtx = createMockContext({
      responses: { orders: { data: validOrder, error: null } },
    });
    const notesOrders = createOrdersWrapper(notesCtx);
    await notesOrders.updateNotes(validOrder.id, { internal_notes: 'x' });
    const tenantEqs = notesCtx
      .getCalls()
      .filter(
        (c: { method: string; args: unknown[] }) => c.method === 'eq' && c.args[0] === 'tenant_id',
      );
    expect(tenantEqs.length).toBe(0);
  });

  it('updateStatus rejects advancing empty orders', async () => {
    const emptyCtx = createMockContext({
      responses: {
        orders: { data: { ...validOrder, status: 'preparing' }, error: null },
        order_items: { data: [], error: null },
      },
    });
    const emptyOrders = createOrdersWrapper(emptyCtx);
    await expect(emptyOrders.updateStatus(validOrder.id, 'preparing')).rejects.toThrow(
      'Cannot advance order with no items',
    );
  });

  it('updateStatus allows cancelling empty orders', async () => {
    const cancelCtx = createMockContext({
      responses: {
        orders: { data: { ...validOrder, status: 'cancelled' }, error: null },
      },
    });
    const cancelOrders = createOrdersWrapper(cancelCtx);
    const result = await cancelOrders.updateStatus(validOrder.id, 'cancelled');
    expect(result.status).toBe('cancelled');
  });

  it('findActiveByTable returns active order', async () => {
    const activeCtx = createMockContext({
      responses: {
        orders: { data: validOrder, error: null },
        orders_decrypted: { data: validOrder, error: null },
      },
    });
    const activeOrders = createOrdersWrapper(activeCtx);
    const result = await activeOrders.findActiveByTable(validOrder.table_id!);
    expect(result).toEqual(validOrder);
  });

  it('throws on supabase error', async () => {
    const errorCtx = createMockContext({
      responses: {
        orders: { data: null, error: { code: '23505', message: 'duplicate' } },
        orders_decrypted: { data: null, error: { code: '23505', message: 'duplicate' } },
      },
    });
    const errorOrders = createOrdersWrapper(errorCtx);
    await expect(errorOrders.findAll({ limit: 50 })).rejects.toThrow();
  });

  // Plan 10 — replay-since-checkpoint catchup. Verifies the wrapper builds
  // the right query: filter on `updated_at > since`, order by `updated_at`,
  // capped at the supplied limit (default 200).
  describe('findChangedSince (Plan 10 catchup)', () => {
    type MockCall = { table: string; method: string; args: unknown[] };

    it('filters on updated_at > since and applies the default 200 cap', async () => {
      const ctx = createMockContext({
        responses: { orders_decrypted: { data: [validOrder], error: null } },
      });
      const ordersW = createOrdersWrapper(ctx);
      const since = new Date('2026-05-05T12:00:00.000Z');
      const result = await ordersW.findChangedSince(since);
      expect(result).toEqual([validOrder]);

      const calls = ctx.getCalls() as MockCall[];
      const gtCall = calls.find((c: MockCall) => c.method === 'gt');
      const limitCall = calls.find((c: MockCall) => c.method === 'limit');
      const orderCall = calls.find((c: MockCall) => c.method === 'order');
      expect(gtCall?.args).toEqual(['updated_at', since.toISOString()]);
      expect(limitCall?.args).toEqual([200]);
      expect(orderCall?.args[0]).toBe('updated_at');
    });

    it('honors a custom limit', async () => {
      const ctx = createMockContext({
        responses: { orders_decrypted: { data: [validOrder], error: null } },
      });
      const ordersW = createOrdersWrapper(ctx);
      await ordersW.findChangedSince(new Date('2026-05-05T12:00:00.000Z'), { limit: 50 });
      const limitCall = (ctx.getCalls() as MockCall[]).find((c: MockCall) => c.method === 'limit');
      expect(limitCall?.args).toEqual([50]);
    });

    it('accepts an ISO string and forwards it verbatim', async () => {
      const ctx = createMockContext({
        responses: { orders_decrypted: { data: [], error: null } },
      });
      const ordersW = createOrdersWrapper(ctx);
      const sinceIso = '2026-05-05T12:00:00.000Z';
      await ordersW.findChangedSince(sinceIso);
      const gtCall = (ctx.getCalls() as MockCall[]).find((c: MockCall) => c.method === 'gt');
      expect(gtCall?.args).toEqual(['updated_at', sinceIso]);
    });
  });
});

describe('OrderItemsWrapper', () => {
  beforeEach(() => {
    resetFactoryCounter();
  });

  it('create inserts order items', async () => {
    const ctx = createMockContext({
      responses: {
        order_items: { data: [validOrderItem], error: null },
      },
    });
    const items = createOrderItemsWrapper(ctx);
    const result = await items.create([
      buildOrderItemInsert({
        order_id: validOrder.id,
        menu_item_id: validOrderItem.menu_item_id,
        quantity: 2,
        item_price: 15.99,
      }),
    ]);
    expect(result).toEqual([validOrderItem]);
  });

  it('updateStatus updates item status', async () => {
    const ctx = createMockContext({
      responses: {
        order_items: { data: { ...validOrderItem, status: 'ready' }, error: null },
      },
    });
    const items = createOrderItemsWrapper(ctx);
    const result = await items.updateStatus(validOrderItem.id, 'ready');
    expect(result.status).toBe('ready');
  });

  // Partial-cancel must go through the cancel_order_item_qty RPC (not a
  // client-side SELECT → mutate → UPDATE) so the read-modify-write is
  // atomic under concurrency. Migration 20260503000007.
  it('cancel with partial qty calls cancel_order_item_qty RPC, not SELECT/UPDATE', async () => {
    const reduced = { ...validOrderItem, quantity: 1 };
    const ctx = createMockContext({
      rpcResponses: {
        cancel_order_item_qty: { data: reduced, error: null },
      },
    });
    const items = createOrderItemsWrapper(ctx);

    const result = await items.cancel(validOrderItem.id, 1);

    expect(result.quantity).toBe(1);
    const calls = ctx.getCalls() as Array<{ table: string; method: string; args: unknown[] }>;
    const rpcCall = calls.find((c) => c.method === 'cancel_order_item_qty');
    expect(rpcCall).toBeDefined();
    expect(rpcCall!.args[0]).toEqual({
      p_order_item_id: validOrderItem.id,
      p_cancel_qty: 1,
    });
    // No SELECT or UPDATE on order_items — the lost-update path is gone.
    expect(calls.find((c) => c.table === 'order_items')).toBeUndefined();
  });

  it('cancel without qty falls back to a single UPDATE (full cancel)', async () => {
    const cancelled = { ...validOrderItem, status: 'cancelled' as const };
    const ctx = createMockContext({
      responses: {
        order_items: { data: cancelled, error: null },
      },
    });
    const items = createOrderItemsWrapper(ctx);

    const result = await items.cancel(validOrderItem.id);

    expect(result.status).toBe('cancelled');
    const calls = ctx.getCalls() as Array<{ table: string; method: string; args: unknown[] }>;
    expect(calls.find((c) => c.method === 'update')).toBeDefined();
    expect(calls.find((c) => c.method === 'cancel_order_item_qty')).toBeUndefined();
  });
});

describe('OrdersWrapper error type verification', () => {
  it('throws ConflictError for duplicate key violation', async () => {
    const errResp = { data: null, error: { code: '23505', message: 'duplicate' } };
    const ctx = createMockContext({
      responses: { orders: errResp, orders_decrypted: errResp },
    });
    const wrapper = createOrdersWrapper(ctx);
    await expect(wrapper.findAll({ limit: 50 })).rejects.toThrow(ConflictError);
  });

  it('throws AuthenticationError for PGRST301 code', async () => {
    const errResp = { data: null, error: { code: 'PGRST301', message: 'JWT expired' } };
    const ctx = createMockContext({
      responses: { orders: errResp, orders_decrypted: errResp },
    });
    const wrapper = createOrdersWrapper(ctx);
    await expect(wrapper.findAll({ limit: 50 })).rejects.toThrow(AuthenticationError);
  });

  it('throws ValidationError for foreign key violation', async () => {
    const errResp = { data: null, error: { code: '23503', message: 'foreign key violation' } };
    const ctx = createMockContext({
      responses: { orders: errResp, orders_decrypted: errResp },
    });
    const wrapper = createOrdersWrapper(ctx);
    await expect(wrapper.findAll({ limit: 50 })).rejects.toThrow(ValidationError);
  });
});

describe('OrdersWrapper applyDiscount', () => {
  it('applies percentage discount', async () => {
    const discountedOrder = {
      ...validOrder,
      discount_type: 'percentage',
      discount_value: 10,
      discount_amount: 5.0,
      discount_reason: 'loyalty',
      discount_applied_by: 'staff-1',
    };
    const ctx = createMockContext({
      responses: {
        orders: { data: discountedOrder, error: null },
      },
    });
    const orders = createOrdersWrapper(ctx);
    await orders.applyDiscount(validOrder.id, {
      discount_type: 'percentage',
      discount_value: 10,
      discount_reason: 'loyalty',
      discount_applied_by: 'staff-1',
    });
  });

  it('applies fixed discount', async () => {
    const ctx = createMockContext({
      responses: {
        orders: { data: null, error: null },
      },
    });
    const orders = createOrdersWrapper(ctx);
    await orders.applyDiscount(validOrder.id, {
      discount_type: 'fixed',
      discount_value: 5,
      discount_applied_by: 'staff-1',
    });
  });

  it('removes discount by setting type to none', async () => {
    const ctx = createMockContext({
      responses: {
        orders: { data: null, error: null },
        orders_decrypted: { data: validOrder, error: null },
      },
    });
    const orders = createOrdersWrapper(ctx);
    await orders.applyDiscount(validOrder.id, {
      discount_type: 'none',
      discount_value: 0,
      discount_applied_by: 'staff-1',
    });
  });

  it('returns updated order data after refetch', async () => {
    const ctx = createMockContext({
      responses: {
        orders: { data: null, error: null },
        orders_decrypted: { data: validOrder, error: null },
      },
    });
    const orders = createOrdersWrapper(ctx);
    const result = await orders.applyDiscount(validOrder.id, {
      discount_type: 'fixed',
      discount_value: 10,
      discount_applied_by: 'staff-1',
    });

    expect(result).toBeDefined();
    expect(result.id).toBe(validOrder.id);
  });

  it('throws on supabase error', async () => {
    const ctx = createMockContext({
      responses: {
        orders: { data: null, error: { code: '23503', message: 'foreign key violation' } },
      },
    });
    const orders = createOrdersWrapper(ctx);
    await expect(
      orders.applyDiscount(validOrder.id, {
        discount_type: 'percentage',
        discount_value: 10,
        discount_applied_by: 'staff-1',
      }),
    ).rejects.toThrow();
  });
});

describe('OrdersWrapper empty data handling', () => {
  it('findAll returns empty array when no orders exist', async () => {
    const emptyResp = { data: [], error: null };
    const ctx = createMockContext({
      responses: { orders: emptyResp, orders_decrypted: emptyResp },
    });
    const wrapper = createOrdersWrapper(ctx);
    const result = await wrapper.findAll({ limit: 50 });
    expect(result).toEqual([]);
  });

  it('findAll returns empty array when data is null', async () => {
    const nullResp = { data: null, error: null };
    const ctx = createMockContext({ responses: { orders: nullResp, orders_decrypted: nullResp } });
    const wrapper = createOrdersWrapper(ctx);
    const result = await wrapper.findAll({ limit: 50 });
    expect(result).toEqual([]);
  });
});

describe('OrderItemsWrapper error type verification', () => {
  it('throws ConflictError for duplicate key violation', async () => {
    const ctx = createMockContext({
      responses: { order_items: { data: null, error: { code: '23505', message: 'duplicate' } } },
    });
    const items = createOrderItemsWrapper(ctx);
    await expect(
      items.create([
        buildOrderItemInsert({
          order_id: validOrder.id,
          menu_item_id: validOrderItem.menu_item_id,
          quantity: 1,
          item_price: 10.0,
        }),
      ]),
    ).rejects.toThrow(ConflictError);
  });

  it('throws AuthenticationError for PGRST301 code', async () => {
    const ctx = createMockContext({
      responses: {
        order_items: { data: null, error: { code: 'PGRST301', message: 'JWT expired' } },
      },
    });
    const items = createOrderItemsWrapper(ctx);
    await expect(items.updateStatus(validOrderItem.id, 'ready')).rejects.toThrow(
      AuthenticationError,
    );
  });

  it('throws ValidationError for foreign key violation', async () => {
    const ctx = createMockContext({
      responses: {
        order_items: { data: null, error: { code: '23503', message: 'foreign key violation' } },
      },
    });
    const items = createOrderItemsWrapper(ctx);
    await expect(items.updateStatus(validOrderItem.id, 'ready')).rejects.toThrow(ValidationError);
  });
});
