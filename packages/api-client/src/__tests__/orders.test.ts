import { AuthenticationError, ConflictError, ValidationError } from '@gustri/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { createOrderItemsWrapper, createOrdersWrapper } from '../wrapper/orders';
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
    const result = await orders.findAll();
    expect(result).toEqual([validOrder]);
  });

  it('findAll applies status filter', async () => {
    await orders.findAll({ status: 'new' });
    const calls = ctx.getCalls();
    expect(calls[0].table).toBe('orders_decrypted');
    expect(calls[0].method).toBe('select');
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
    await expect(errorOrders.findAll()).rejects.toThrow();
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
});

describe('OrdersWrapper error type verification', () => {
  it('throws ConflictError for duplicate key violation', async () => {
    const errResp = { data: null, error: { code: '23505', message: 'duplicate' } };
    const ctx = createMockContext({
      responses: { orders: errResp, orders_decrypted: errResp },
    });
    const wrapper = createOrdersWrapper(ctx);
    await expect(wrapper.findAll()).rejects.toThrow(ConflictError);
  });

  it('throws AuthenticationError for PGRST301 code', async () => {
    const errResp = { data: null, error: { code: 'PGRST301', message: 'JWT expired' } };
    const ctx = createMockContext({
      responses: { orders: errResp, orders_decrypted: errResp },
    });
    const wrapper = createOrdersWrapper(ctx);
    await expect(wrapper.findAll()).rejects.toThrow(AuthenticationError);
  });

  it('throws ValidationError for foreign key violation', async () => {
    const errResp = { data: null, error: { code: '23503', message: 'foreign key violation' } };
    const ctx = createMockContext({
      responses: { orders: errResp, orders_decrypted: errResp },
    });
    const wrapper = createOrdersWrapper(ctx);
    await expect(wrapper.findAll()).rejects.toThrow(ValidationError);
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
    const result = await wrapper.findAll();
    expect(result).toEqual([]);
  });

  it('findAll returns empty array when data is null', async () => {
    const nullResp = { data: null, error: null };
    const ctx = createMockContext({ responses: { orders: nullResp, orders_decrypted: nullResp } });
    const wrapper = createOrdersWrapper(ctx);
    const result = await wrapper.findAll();
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
