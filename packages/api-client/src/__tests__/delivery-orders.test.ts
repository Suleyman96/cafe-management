import { beforeEach, describe, expect, it } from 'vitest';
import { createOrdersWrapper } from '../wrapper/orders';
import { createMockContext } from './helpers/mock-supabase';

const validDeliveryOrder = {
  id: '123e4567-e89b-12d3-a456-426614174100',
  status: 'new',
  source: 'customer',
  order_type: 'delivery',
  table_id: null,
  customer_name: 'John Doe',
  customer_phone: '+994501234567',
  delivery_address: '123 Main Street, Apt 4',
  delivery_fee: 3.0,
  delivery_notes: 'Ring doorbell',
  delivery_person_id: null,
  delivered_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('Delivery Orders', () => {
  let ctx: ReturnType<typeof createMockContext>;
  let orders: ReturnType<typeof createOrdersWrapper>;

  beforeEach(() => {
    const resp = { data: [validDeliveryOrder], error: null };
    ctx = createMockContext({
      responses: {
        orders: resp,
        orders_decrypted: resp,
      },
    });
    orders = createOrdersWrapper(ctx);
  });

  it('findDeliveryOrders returns delivery orders', async () => {
    const result = await orders.findDeliveryOrders();
    expect(result).toEqual([validDeliveryOrder]);
    const calls = ctx.getCalls();
    expect(calls[0].table).toBe('orders_decrypted');
    expect(calls[0].method).toBe('select');
  });

  it('findDeliveryById returns single delivery order', async () => {
    const singleResp = { data: validDeliveryOrder, error: null };
    const singleCtx = createMockContext({
      responses: {
        orders: singleResp,
        orders_decrypted: singleResp,
      },
    });
    const singleOrders = createOrdersWrapper(singleCtx);
    const result = await singleOrders.findDeliveryById(validDeliveryOrder.id);
    expect(result).toEqual(validDeliveryOrder);
  });

  it('assignDeliveryPerson updates delivery_person_id', async () => {
    const staffId = '123e4567-e89b-12d3-a456-426614174200';
    const updateCtx = createMockContext({
      responses: {
        orders: { data: { ...validDeliveryOrder, delivery_person_id: staffId }, error: null },
      },
    });
    const updateOrders = createOrdersWrapper(updateCtx);
    const result = await updateOrders.assignDeliveryPerson(validDeliveryOrder.id, staffId);
    expect(result.delivery_person_id).toBe(staffId);
    const calls = updateCtx.getCalls();
    expect(calls[0].table).toBe('orders');
    expect(calls[0].method).toBe('update');
  });

  it('updateDeliveryFee modifies fee', async () => {
    const updateCtx = createMockContext({
      responses: {
        orders: { data: { ...validDeliveryOrder, delivery_fee: 5.0 }, error: null },
      },
    });
    const updateOrders = createOrdersWrapper(updateCtx);
    const result = await updateOrders.updateDeliveryFee(validDeliveryOrder.id, 5.0);
    expect(result.delivery_fee).toBe(5.0);
  });

  it('markOutForDelivery updates status and delivery_person', async () => {
    const staffId = '123e4567-e89b-12d3-a456-426614174200';
    const updateCtx = createMockContext({
      responses: {
        orders: {
          data: {
            ...validDeliveryOrder,
            status: 'out_for_delivery',
            delivery_person_id: staffId,
          },
          error: null,
        },
      },
    });
    const updateOrders = createOrdersWrapper(updateCtx);
    const result = await updateOrders.markOutForDelivery(validDeliveryOrder.id, staffId);
    expect(result.status).toBe('out_for_delivery');
    expect(result.delivery_person_id).toBe(staffId);
  });

  it('markDelivered updates status and delivered_at', async () => {
    const updateCtx = createMockContext({
      responses: {
        orders: {
          data: {
            ...validDeliveryOrder,
            status: 'delivered',
            delivered_at: new Date().toISOString(),
          },
          error: null,
        },
      },
    });
    const updateOrders = createOrdersWrapper(updateCtx);
    const result = await updateOrders.markDelivered(validDeliveryOrder.id);
    expect(result.status).toBe('delivered');
    expect(result.delivered_at).toBeTruthy();
  });
});
