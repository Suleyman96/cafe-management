import { describe, expect, it } from 'vitest';
import { createViewsWrapper } from '../wrapper/views';
import { createMockContext } from './helpers/mock-supabase';

const salesRow = {
  date: '2024-06-15',
  total_revenue: 1500.0,
  total_orders: 25,
};

const paymentSummary = {
  order_id: 'order-1',
  total_amount: 100.0,
  total_paid: 75.0,
  remaining: 25.0,
};

describe('ViewsWrapper', () => {
  it('getSalesSummary returns sales data', async () => {
    const ctx = createMockContext({
      responses: {
        sales_summary_view: { data: [salesRow], error: null },
      },
    });
    const views = createViewsWrapper(ctx);
    const result = await views.getSalesSummary();
    expect(result).toEqual([salesRow]);
  });

  it('getSalesSummary accepts date range filters', async () => {
    const ctx = createMockContext({
      responses: {
        sales_summary_view: { data: [salesRow], error: null },
      },
    });
    const views = createViewsWrapper(ctx);
    const result = await views.getSalesSummary('2024-06-01', '2024-06-30');
    expect(result).toEqual([salesRow]);
  });

  it('getSalesSummary returns empty array when no data', async () => {
    const ctx = createMockContext({
      responses: {
        sales_summary_view: { data: null, error: null },
      },
    });
    const views = createViewsWrapper(ctx);
    const result = await views.getSalesSummary();
    expect(result).toEqual([]);
  });

  it('getOrderPaymentSummary returns payment summary', async () => {
    const ctx = createMockContext({
      responses: {
        order_payment_summary: { data: [paymentSummary], error: null },
      },
    });
    const views = createViewsWrapper(ctx);
    const result = await views.getOrderPaymentSummary();
    expect(result).toEqual([paymentSummary]);
  });

  it('getOrderPaymentSummary filters by orderId', async () => {
    const ctx = createMockContext({
      responses: {
        order_payment_summary: { data: [paymentSummary], error: null },
      },
    });
    const views = createViewsWrapper(ctx);
    const result = await views.getOrderPaymentSummary('order-1');
    expect(result).toEqual([paymentSummary]);
  });

  it('throws on supabase error', async () => {
    const ctx = createMockContext({
      responses: {
        sales_summary_view: { data: null, error: { status: 500, message: 'Internal' } },
      },
    });
    const views = createViewsWrapper(ctx);
    await expect(views.getSalesSummary()).rejects.toThrow();
  });
});
