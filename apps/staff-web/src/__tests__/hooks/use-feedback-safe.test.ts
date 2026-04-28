import { QUERY_KEYS } from '@gustri/queries';
import { describe, expect, it, vi } from 'vitest';
import {
  useFeedback,
  useMarkFeedbackRead,
  usePendingFeedbackCount,
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
    expect(db.feedback.findAll).toHaveBeenCalledWith({ status: 'pending' });
  });
});

describe('usePendingFeedbackCount', () => {
  it('calls getPendingCount', () => {
    renderHookWithProviders(() => usePendingFeedbackCount());
    expect(db.feedback.getPendingCount).toHaveBeenCalled();
  });
});

describe('useMarkFeedbackRead', () => {
  it('invalidates feedback on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMarkFeedbackRead());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ feedbackId: 'f1', staffId: 's1' });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.FEEDBACK]);
  });
});
