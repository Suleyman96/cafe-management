import { AuthenticationError, ConflictError, ValidationError } from '@gustri/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPaymentsWrapper } from '../wrapper/payments';
import { buildPaymentInsert, resetFactoryCounter } from './helpers/factories';
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
  beforeEach(() => {
    resetFactoryCounter();
  });

  it('create inserts payment data', async () => {
    const ctx = createMockContext({
      responses: {
        order_payments: { data: validPayment, error: null },
      },
    });
    const payments = createPaymentsWrapper(ctx);
    const result = await payments.create(
      buildPaymentInsert({
        order_id: validPayment.order_id,
        amount: 50.0,
        payment_method: 'cash',
      }),
    );
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
      payments.create(buildPaymentInsert({ order_id: 'bad', amount: 10, payment_method: 'cash' })),
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

  it('create throws when type guard rejects data (missing order_id, amount, payment_method)', async () => {
    const ctx = createMockContext({
      responses: {
        order_payments: { data: { id: '1' }, error: null },
      },
    });
    const payments = createPaymentsWrapper(ctx);
    await expect(
      payments.create(
        buildPaymentInsert({ order_id: 'ord-1', amount: 50, payment_method: 'cash' }),
      ),
    ).rejects.toThrow('Invalid payment data');
  });

  it('throws ConflictError for duplicate key violation (23505)', async () => {
    const ctx = createMockContext({
      responses: {
        order_payments: { data: null, error: { code: '23505', message: 'duplicate key' } },
      },
    });
    const payments = createPaymentsWrapper(ctx);
    await expect(
      payments.create(
        buildPaymentInsert({ order_id: 'ord-1', amount: 50, payment_method: 'cash' }),
      ),
    ).rejects.toThrow(ConflictError);
  });

  it('throws ValidationError for foreign key violation (23503)', async () => {
    const ctx = createMockContext({
      responses: {
        order_payments: { data: null, error: { code: '23503', message: 'fk violation' } },
      },
    });
    const payments = createPaymentsWrapper(ctx);
    await expect(
      payments.create(
        buildPaymentInsert({ order_id: 'bad-id', amount: 50, payment_method: 'cash' }),
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('throws AuthenticationError for 401 status', async () => {
    const ctx = createMockContext({
      responses: {
        order_payments: { data: null, error: { status: 401 } },
      },
    });
    const payments = createPaymentsWrapper(ctx);
    await expect(
      payments.create(
        buildPaymentInsert({ order_id: 'ord-1', amount: 50, payment_method: 'cash' }),
      ),
    ).rejects.toThrow(AuthenticationError);
  });

  it('findByDateRange returns payments for a date range', async () => {
    const ctx = createMockContext({
      responses: {
        order_payments: { data: [validPayment], error: null },
      },
    });
    const payments = createPaymentsWrapper(ctx);
    const result = await payments.findByDateRange('2026-03-28T00:00:00', '2026-03-29T00:00:00');
    expect(result).toEqual([validPayment]);
  });

  it('findByDateRange returns empty array when no payments', async () => {
    const ctx = createMockContext({
      responses: {
        order_payments: { data: [], error: null },
      },
    });
    const payments = createPaymentsWrapper(ctx);
    const result = await payments.findByDateRange('2026-03-28T00:00:00', '2026-03-29T00:00:00');
    expect(result).toEqual([]);
  });

  it('create calls insert method (not select)', async () => {
    const ctx = createMockContext({
      responses: {
        order_payments: { data: validPayment, error: null },
      },
    });
    const payments = createPaymentsWrapper(ctx);
    await payments.create(
      buildPaymentInsert({
        order_id: validPayment.order_id,
        amount: 50.0,
        payment_method: 'cash',
      }),
    );
    const calls = ctx.getCalls();
    expect(calls[0].method).toBe('insert');
    expect(calls[0].table).toBe('order_payments');
  });
});
