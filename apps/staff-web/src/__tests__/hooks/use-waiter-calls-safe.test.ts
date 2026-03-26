import { QUERY_KEYS } from '@cafe-idare/core';
import { describe, expect, it, vi } from 'vitest';
import {
  useAcknowledgeWaiterCall,
  usePendingWaiterCallsCount,
  useResolveWaiterCall,
  useWaiterCalls,
} from '@/hooks/use-waiter-calls-safe';
import { db } from '@/lib/supabase/wrapped-client';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useWaiterCalls', () => {
  it('calls db.waiterCalls.findAll', () => {
    renderHookWithProviders(() => useWaiterCalls());
    expect(db.waiterCalls.findAll).toHaveBeenCalled();
  });

  it('passes status filter', () => {
    renderHookWithProviders(() => useWaiterCalls('pending' as any));
    expect(db.waiterCalls.findAll).toHaveBeenCalledWith('pending');
  });
});

describe('usePendingWaiterCallsCount', () => {
  it('calls getPendingCount', () => {
    renderHookWithProviders(() => usePendingWaiterCallsCount());
    expect(db.waiterCalls.getPendingCount).toHaveBeenCalled();
  });
});

describe('useAcknowledgeWaiterCall', () => {
  it('invalidates WAITER_CALLS and waiter-calls-count on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useAcknowledgeWaiterCall());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ callId: 'c1', staffId: 's1' });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.WAITER_CALLS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.WAITER_CALLS_COUNT]);
  });
});

describe('useResolveWaiterCall', () => {
  it('invalidates WAITER_CALLS, waiter-calls-count, and TABLES on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useResolveWaiterCall());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ callId: 'c1', notes: 'Resolved' });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.WAITER_CALLS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.WAITER_CALLS_COUNT]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.TABLES]);
  });
});
