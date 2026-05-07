import { describe, expect, it } from 'vitest';
import { createFeedbackWrapper } from '../wrapper/feedback';
import { createMockContext } from './helpers/mock-supabase';

const validFeedback = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  table_id: '123e4567-e89b-12d3-a456-426614174001',
  feedback_type: 'praise',
  message: 'Great service!',
  status: 'pending',
  created_at: new Date().toISOString(),
};

describe('FeedbackWrapper', () => {
  // `create` was deleted in audit 18 once customer-web migrated to the
  // `/api/v1/customer/feedback` route. Tests for the insert path live
  // alongside the route at `apps/staff-web/src/__tests__/api/`.

  it('findAll returns feedback list', async () => {
    const ctx = createMockContext({
      responses: {
        customer_feedback: { data: [validFeedback], error: null },
      },
    });
    const feedback = createFeedbackWrapper(ctx);
    const result = await feedback.findAll();
    expect(result).toEqual([validFeedback]);
  });

  it('findAll filters by status', async () => {
    const ctx = createMockContext({
      responses: {
        customer_feedback: { data: [validFeedback], error: null },
      },
    });
    const feedback = createFeedbackWrapper(ctx);
    await feedback.findAll({ status: 'pending' });
    const calls = ctx.getCalls();
    expect(calls[0].table).toBe('customer_feedback');
  });

  it('markRead sets acknowledged_at and staff', async () => {
    const readFeedback = {
      ...validFeedback,
      status: 'acknowledged',
      responded_by: 'staff-123',
    };
    const ctx = createMockContext({
      responses: {
        customer_feedback: { data: readFeedback, error: null },
      },
    });
    const feedback = createFeedbackWrapper(ctx);
    const result = await feedback.markRead(validFeedback.id, 'staff-123');
    expect(result.status).toBe('acknowledged');
    expect(ctx.getCalls()[0].method).toBe('update');
  });

  it('getPendingCount returns count', async () => {
    const ctx = createMockContext({
      responses: {
        customer_feedback: { data: null, error: null, count: 5 },
      },
    });
    const feedback = createFeedbackWrapper(ctx);
    const result = await feedback.getPendingCount();
    expect(result).toBe(5);
  });

  it('getPendingCount returns 0 when no count', async () => {
    const ctx = createMockContext({
      responses: {
        customer_feedback: { data: null, error: null },
      },
    });
    const feedback = createFeedbackWrapper(ctx);
    const result = await feedback.getPendingCount();
    expect(result).toBe(0);
  });

  it('throws on supabase error', async () => {
    const ctx = createMockContext({
      responses: {
        customer_feedback: { data: null, error: { code: 'PGRST301' } },
      },
    });
    const feedback = createFeedbackWrapper(ctx);
    await expect(feedback.findAll()).rejects.toThrow();
  });
});
