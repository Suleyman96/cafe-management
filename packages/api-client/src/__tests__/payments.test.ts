import { describe, expect, it } from 'vitest';
import { createPaymentsWrapper } from '../wrapper/payments';
import { createMockContext } from './helpers/mock-supabase';

const validPayment = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  order_id: '123e4567-e89b-12d3-a456-426614174001',
  amount: 50.0,
  payment_method: 'cash',
  received_by: '123e4567-e89b-12d3-a456-426614174002',
  created_at: new Date().toISOString(),
};

describe('PaymentsWrapper', () => {
  it('create inserts payment data', async () => {
    const ctx = createMockContext({
      responses: {
        order_payments: { data: validPayment, error: null },
      },
    });
    const payments = createPaymentsWrapper(ctx);
    const result = await payments.create({
      order_id: validPayment.order_id,
      amount: 50.0,
      payment_method: 'cash',
    } as any);
    expect(result).toEqual(validPayment);
    expect(ctx.getCalls()[0].method).toBe('insert');
  });

  it('findByOrderId returns payments for an order', async () => {
    const ctx = createMockContext({
      responses: {
        order_payments: { data: [validPayment], error: null },
      },
    });
    const payments = createPaymentsWrapper(ctx);
    const result = await payments.findByOrderId(validPayment.order_id);
    expect(result).toEqual([validPayment]);
  });

  it('findByOrderId returns empty array when no payments', async () => {
    const ctx = createMockContext({
      responses: {
        order_payments: { data: [], error: null },
      },
    });
    const payments = createPaymentsWrapper(ctx);
    const result = await payments.findByOrderId('nonexistent');
    expect(result).toEqual([]);
  });

  it('throws on supabase error for create', async () => {
    const ctx = createMockContext({
      responses: {
        order_payments: { data: null, error: { code: '23503', message: 'fk violation' } },
      },
    });
    const payments = createPaymentsWrapper(ctx);
    await expect(
      payments.create({ order_id: 'bad', amount: 10, payment_method: 'cash' } as any),
    ).rejects.toThrow();
  });

  it('findByReceivedBy returns payments for a staff member', async () => {
    const ctx = createMockContext({
      responses: {
        order_payments: { data: [validPayment], error: null },
      },
    });
    const payments = createPaymentsWrapper(ctx);
    const result = await payments.findByReceivedBy(validPayment.received_by);
    expect(result).toEqual([validPayment]);
  });

  it('findByReceivedBy returns empty array when no payments', async () => {
    const ctx = createMockContext({
      responses: {
        order_payments: { data: [], error: null },
      },
    });
    const payments = createPaymentsWrapper(ctx);
    const result = await payments.findByReceivedBy('nonexistent');
    expect(result).toEqual([]);
  });

  it('throws on supabase error for findByOrderId', async () => {
    const ctx = createMockContext({
      responses: {
        order_payments: { data: null, error: { status: 401 } },
      },
    });
    const payments = createPaymentsWrapper(ctx);
    await expect(payments.findByOrderId('any')).rejects.toThrow();
  });
});
