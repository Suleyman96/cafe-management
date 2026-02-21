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
      },
    });
    const updateOrders = createOrdersWrapper(updateCtx);
    const result = await updateOrders.updateStatus(validOrder.id, 'preparing');
    expect(result.status).toBe('preparing');
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
