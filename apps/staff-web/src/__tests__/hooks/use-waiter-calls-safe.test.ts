import { QUERY_KEYS } from '@gustri/queries';
import { describe, expect, it, vi } from 'vitest';
import {
  useAcknowledgeWaiterCall,
  usePendingWaiterCallsCount,
  useResolveWaiterCall,
  useWaiterCalls,
} from '@/hooks/use-waiter-calls-safe';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useWaiterCalls', () => {
  it('calls db.waiterCalls.findAll', () => {
    const { mockDb } = renderHookWithProviders(() => useWaiterCalls());
    expect(mockDb.waiterCalls.findAll).toHaveBeenCalled();
  });

  it('passes status filter', () => {
    const { mockDb } = renderHookWithProviders(() => useWaiterCalls('pending' as any));
    expect(mockDb.waiterCalls.findAll).toHaveBeenCalledWith({ status: 'pending' });
  });
});

describe('usePendingWaiterCallsCount', () => {
  it('calls getPendingCount', () => {
    const { mockDb } = renderHookWithProviders(() => usePendingWaiterCallsCount());
    expect(mockDb.waiterCalls.getPendingCount).toHaveBeenCalled();
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
  it('invalidates WAITER_CALLS and waiter-calls-count on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useResolveWaiterCall());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ callId: 'c1', notes: 'Resolved' });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.WAITER_CALLS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.WAITER_CALLS_COUNT]);
  });
});
