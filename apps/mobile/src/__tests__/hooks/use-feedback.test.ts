import { describe, expect, it, vi } from 'vitest';
import { useFeedback, useMarkFeedbackRead, usePendingFeedbackCount } from '@/hooks/use-feedback';
import { db } from '@/lib/supabase';
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

describe('useMarkFeedbackRead', () => {
  it('invalidates feedback on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMarkFeedbackRead());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 'f1', staffId: 's1' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['feedback']);
  });
});
