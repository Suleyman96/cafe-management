import { describe, expect, it, vi } from 'vitest';
import { useFeedback, useMarkFeedbackRead, usePendingFeedbackCount } from '@/hooks/use-feedback';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useFeedback', () => {
  it('calls db.feedback.findAll', () => {
    const { mockDb } = renderHookWithProviders(() => useFeedback());
    expect(mockDb.feedback.findAll).toHaveBeenCalled();
  });

  it('passes status filter', () => {
    const { mockDb } = renderHookWithProviders(() => useFeedback('pending'));
    expect(mockDb.feedback.findAll).toHaveBeenCalledWith({ status: 'pending' });
  });
});

describe('usePendingFeedbackCount', () => {
  it('calls getPendingCount', () => {
    const { mockDb } = renderHookWithProviders(() => usePendingFeedbackCount());
    expect(mockDb.feedback.getPendingCount).toHaveBeenCalled();
  });
});

describe('useMarkFeedbackRead', () => {
  it('invalidates feedback on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMarkFeedbackRead());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 'f1', staffId: 's1' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['feedback']);
  });
});
