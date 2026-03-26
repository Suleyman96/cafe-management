import { AuthenticationError, ConflictError, ValidationError } from '@cafe-idare/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { createOrderItemsWrapper, createOrdersWrapper } from '../wrapper/orders';
import { createMockContext } from './helpers/mock-supabase';

const validOrder = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  status: 'new',
  source: 'customer',
  table_id: '123e4567-e89b-12d3-a456-426614174001',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const validOrderItem = {
  id: '123e4567-e89b-12d3-a456-426614174010',
  order_id: validOrder.id,
  menu_item_id: '123e4567-e89b-12d3-a456-426614174020',
  quantity: 2,
  item_price: 15.99,
  status: 'pending',
};

describe('OrdersWrapper', () => {
  let ctx: ReturnType<typeof createMockContext>;
  let orders: ReturnType<typeof createOrdersWrapper>;

  beforeEach(() => {
    ctx = createMockContext({
      responses: {
        orders: { data: [validOrder], error: null },
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
    expect(calls[0].table).toBe('orders');
    expect(calls[0].method).toBe('select');
  });

  it('findById returns single order', async () => {
    const singleCtx = createMockContext({
      responses: {
        orders: { data: validOrder, error: null },
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
    const result = await createOrders.create({
      status: 'new',
      source: 'customer',
      table_id: validOrder.table_id,
    } as any);
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
      },
    });
    const errorOrders = createOrdersWrapper(errorCtx);
    await expect(errorOrders.findAll()).rejects.toThrow();
  });
});

describe('OrderItemsWrapper', () => {
  it('create inserts order items', async () => {
    const ctx = createMockContext({
      responses: {
        order_items: { data: [validOrderItem], error: null },
      },
    });
    const items = createOrderItemsWrapper(ctx);
    const result = await items.create([
      {
        order_id: validOrder.id,
        menu_item_id: validOrderItem.menu_item_id,
        quantity: 2,
        item_price: 15.99,
      } as any,
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
    const ctx = createMockContext({
      responses: { orders: { data: null, error: { code: '23505', message: 'duplicate' } } },
    });
    const wrapper = createOrdersWrapper(ctx);
    await expect(wrapper.findAll()).rejects.toThrow(ConflictError);
  });

  it('throws AuthenticationError for PGRST301 code', async () => {
    const ctx = createMockContext({
      responses: { orders: { data: null, error: { code: 'PGRST301', message: 'JWT expired' } } },
    });
    const wrapper = createOrdersWrapper(ctx);
    await expect(wrapper.findAll()).rejects.toThrow(AuthenticationError);
  });

  it('throws ValidationError for foreign key violation', async () => {
    const ctx = createMockContext({
      responses: {
        orders: { data: null, error: { code: '23503', message: 'foreign key violation' } },
      },
    });
    const wrapper = createOrdersWrapper(ctx);
    await expect(wrapper.findAll()).rejects.toThrow(ValidationError);
  });
});

describe('OrdersWrapper empty data handling', () => {
  it('findAll returns empty array when no orders exist', async () => {
    const ctx = createMockContext({ responses: { orders: { data: [], error: null } } });
    const wrapper = createOrdersWrapper(ctx);
    const result = await wrapper.findAll();
    expect(result).toEqual([]);
  });

  it('findAll returns empty array when data is null', async () => {
    const ctx = createMockContext({ responses: { orders: { data: null, error: null } } });
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
        {
          order_id: validOrder.id,
          menu_item_id: validOrderItem.menu_item_id,
          quantity: 1,
          item_price: 10.0,
        } as any,
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
