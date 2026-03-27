import { QUERY_KEYS } from '@cafe-idare/core';
import { describe, expect, it, vi } from 'vitest';
import {
  useAcknowledgeFeedback,
  useDismissFeedback,
  useFeedback,
  usePendingFeedbackCount,
  useRespondToFeedback,
} from '@/hooks/use-feedback-safe';
import { db } from '@/lib/supabase/wrapped-client';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useFeedback', () => {
  it('calls db.feedback.findAll', () => {
    renderHookWithProviders(() => useFeedback());
    expect(db.feedback.findAll).toHaveBeenCalled();
  });

  it('passes status filter', () => {
    renderHookWithProviders(() => useFeedback('pending'));
    expect(db.feedback.findAll).toHaveBeenCalledWith('pending');
  });
});

describe('usePendingFeedbackCount', () => {
  it('calls getPendingCount', () => {
    renderHookWithProviders(() => usePendingFeedbackCount());
    expect(db.feedback.getPendingCount).toHaveBeenCalled();
  });
});

describe('useAcknowledgeFeedback', () => {
  it('invalidates feedback and feedback-count on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useAcknowledgeFeedback());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ feedbackId: 'f1', staffId: 's1' });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.FEEDBACK]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.FEEDBACK, 'count']);
  });
});

describe('useRespondToFeedback', () => {
  it('invalidates feedback and feedback-count on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useRespondToFeedback());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({
      feedbackId: 'f1',
      staffId: 's1',
      response: 'Thanks',
      status: 'resolved',
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.FEEDBACK]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.FEEDBACK, 'count']);
  });
});

describe('useDismissFeedback', () => {
  it('invalidates feedback and feedback-count on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDismissFeedback());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('f1');

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.FEEDBACK]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.FEEDBACK, 'count']);
  });
});
