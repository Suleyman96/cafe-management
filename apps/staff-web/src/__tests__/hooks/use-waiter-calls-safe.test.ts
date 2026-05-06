import { ConflictError } from '@gustri/core';
import { QUERY_KEYS, tenantKey } from '@gustri/queries';
import { describe, expect, it, vi } from 'vitest';
import {
  useAcknowledgeWaiterCall,
  usePendingWaiterCallsCount,
  useResolveWaiterCall,
  useWaiterCalls,
} from '@/hooks/use-waiter-calls-safe';
import { renderHookWithProviders, TEST_TENANT_ID } from '../helpers/test-utils';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from 'sonner';

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
  it('forwards client_request_id auto-stamp to wrapper', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useAcknowledgeWaiterCall());
    await result.current.mutateAsync({ callId: 'c1', staffId: 's1' });
    expect(mockDb.waiterCalls.acknowledge).toHaveBeenCalledWith(
      'c1',
      's1',
      expect.objectContaining({ clientRequestId: expect.any(String) }),
    );
  });

  it('invalidates WAITER_CALLS and waiter-calls-count on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useAcknowledgeWaiterCall());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ callId: 'c1', staffId: 's1' });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.WAITER_CALLS));
    expect(invalidatedKeys).toContainEqual(
      tenantKey(TEST_TENANT_ID, QUERY_KEYS.WAITER_CALLS_COUNT),
    );
  });

  it('on waiter_call_already_acknowledged shows localized toast naming the responder', async () => {
    vi.mocked(toast.error).mockClear();
    const { result, mockDb } = renderHookWithProviders(() => useAcknowledgeWaiterCall());
    mockDb.waiterCalls.acknowledge = vi
      .fn()
      .mockRejectedValueOnce(new ConflictError('waiter_call_already_acknowledged'));
    mockDb.waiterCalls.findAll = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'c1', responded_by: 'staff-other' }]);
    mockDb.staff.findById = vi
      .fn()
      .mockResolvedValueOnce({ id: 'staff-other', full_name: 'Aigerim' });

    await expect(result.current.mutateAsync({ callId: 'c1', staffId: 's1' })).rejects.toThrow();

    // The toast message uses the localized template — the mock i18n
    // doesn't interpolate, so we assert the template rather than the
    // interpolated string.
    expect(toast.error).toHaveBeenCalledWith('Already answered by {{name}}');
  });
});

describe('useResolveWaiterCall', () => {
  it('forwards notes + client_request_id', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useResolveWaiterCall());
    await result.current.mutateAsync({ callId: 'c1', notes: 'Resolved' });
    expect(mockDb.waiterCalls.resolve).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ notes: 'Resolved', clientRequestId: expect.any(String) }),
    );
  });

  it('invalidates WAITER_CALLS and waiter-calls-count on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useResolveWaiterCall());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ callId: 'c1', notes: 'Resolved' });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.WAITER_CALLS));
    expect(invalidatedKeys).toContainEqual(
      tenantKey(TEST_TENANT_ID, QUERY_KEYS.WAITER_CALLS_COUNT),
    );
  });
});
