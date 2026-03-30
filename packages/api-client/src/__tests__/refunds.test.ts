import { describe, expect, it } from 'vitest';
import { createRefundsWrapper } from '../wrapper/refunds';
import { createMockContext } from './helpers/mock-supabase';

const validRefund = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  order_id: '123e4567-e89b-12d3-a456-426614174001',
  processed_by: '123e4567-e89b-12d3-a456-426614174002',
  amount: 25.0,
  reason: 'Customer complaint',
  refund_method: 'cash',
  order_item_ids: null,
  notes: null,
  created_at: new Date().toISOString(),
};

describe('RefundsWrapper', () => {
  it('create inserts refund data', async () => {
    const ctx = createMockContext({
      responses: {
        refunds: { data: validRefund, error: null },
      },
    });
    const refunds = createRefundsWrapper(ctx);
    const result = await refunds.create({
      order_id: validRefund.order_id,
      processed_by: validRefund.processed_by,
      amount: 25.0,
      reason: 'Customer complaint',
      refund_method: 'cash',
    });
    expect(result).toEqual(validRefund);
  });

  it('findByOrderId returns refunds for an order', async () => {
    const ctx = createMockContext({
      responses: {
        refunds: { data: [validRefund], error: null },
      },
    });
    const refunds = createRefundsWrapper(ctx);
    const result = await refunds.findByOrderId(validRefund.order_id);
    expect(result).toEqual([validRefund]);
  });

  it('findByOrderId returns empty array when no refunds', async () => {
    const ctx = createMockContext({
      responses: {
        refunds: { data: [], error: null },
      },
    });
    const refunds = createRefundsWrapper(ctx);
    const result = await refunds.findByOrderId('nonexistent');
    expect(result).toEqual([]);
  });

  it('findByDateRange returns refunds for a date range', async () => {
    const ctx = createMockContext({
      responses: {
        refunds: { data: [validRefund], error: null },
      },
    });
    const refunds = createRefundsWrapper(ctx);
    const result = await refunds.findByDateRange('2026-03-28T00:00:00', '2026-03-29T00:00:00');
    expect(result).toEqual([validRefund]);
  });

  it('throws on supabase error', async () => {
    const ctx = createMockContext({
      responses: {
        refunds: { data: null, error: { code: '23503', message: 'fk violation' } },
      },
    });
    const refunds = createRefundsWrapper(ctx);
    await expect(
      refunds.create({
        order_id: 'bad',
        processed_by: 'staff-1',
        amount: 10,
        reason: 'test',
        refund_method: 'cash',
      }),
    ).rejects.toThrow();
  });
});
