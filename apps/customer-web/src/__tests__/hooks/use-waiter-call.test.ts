import { QUERY_KEYS } from '@gustri/queries';
import { useCreateWaiterCall } from '@/hooks/use-waiter-call';
import { apiRoutes } from '@/lib/api-routes';
import { renderHookWithProviders } from '../helpers/test-utils';

// PR3 / H1: this hook now POSTs through `/api/v1/customer/waiter-calls` so
// the Upstash limiter at the staff-web edge gates it. The wrapper path
// (`db.waiterCalls.create`) is no longer reachable from this hook, so
// the assertions key off the API route mock.

const UUID_V4 = expect.stringMatching(
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
);

describe('useCreateWaiterCall', () => {
  it('calls apiRoutes.customerWaiterCalls.create with the route shape', async () => {
    const { result } = renderHookWithProviders(() => useCreateWaiterCall());

    await result.current.mutateAsync({
      tableId: 'table-1',
      callType: 'assistance',
      reason: 'Need help',
      priority: 'normal',
    });

    expect(apiRoutes.customerWaiterCalls.create).toHaveBeenCalledWith({
      table_id: 'table-1',
      call_type: 'assistance',
      reason: 'Need help',
      priority: 'normal',
      notes: null,
      client_request_id: UUID_V4,
    });
  });

  it('does NOT pass tenant_id in the body (server resolves from table_id, H1)', async () => {
    const { result } = renderHookWithProviders(() => useCreateWaiterCall());

    await result.current.mutateAsync({
      tableId: 'table-1',
      callType: 'bill',
      reason: 'r',
      priority: 'normal',
    });

    const payload = (apiRoutes.customerWaiterCalls.create as any).mock.calls[0][0];
    expect(payload).not.toHaveProperty('tenant_id');
  });

  it('forwards notes when provided', async () => {
    const { result } = renderHookWithProviders(() => useCreateWaiterCall());

    await result.current.mutateAsync({
      tableId: 'table-1',
      callType: 'bill',
      reason: 'Default reason',
      priority: 'high',
      notes: 'Custom note',
    });

    expect(apiRoutes.customerWaiterCalls.create).toHaveBeenCalledWith(
      expect.objectContaining({ notes: 'Custom note' }),
    );
  });

  it('passes notes=null when omitted', async () => {
    const { result } = renderHookWithProviders(() => useCreateWaiterCall());

    await result.current.mutateAsync({
      tableId: 'table-1',
      callType: 'question',
      reason: 'r',
      priority: 'low',
    });

    expect(apiRoutes.customerWaiterCalls.create).toHaveBeenCalledWith(
      expect.objectContaining({ notes: null }),
    );
  });

  it('invalidates WAITER_CALLS scoped to tableId', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateWaiterCall());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({
      tableId: 'table-1',
      callType: 'assistance',
      reason: 'Help',
      priority: 'normal',
    });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.WAITER_CALLS, 'table-1']);
  });

  it('reuses the same client_request_id across React Query retries', async () => {
    // The hook stamps the id in `onMutate` and reuses it in `mutationFn`.
    // Without that, a flaky-network retry would mint a fresh UUID each
    // attempt and bypass the (tenant_id, client_request_id) dedupe index.
    const { result } = renderHookWithProviders(() => useCreateWaiterCall());

    const variables = {
      tableId: 'table-1',
      callType: 'assistance' as const,
      reason: 'Help',
      priority: 'normal' as const,
    };

    await result.current.mutateAsync(variables);
    const firstId = (apiRoutes.customerWaiterCalls.create as any).mock.calls[0][0]
      .client_request_id;

    // Same variables object — the id stamped onto it should persist.
    expect((variables as { client_request_id?: string }).client_request_id).toBe(firstId);
  });
});

describe('useCreateWaiterCall - error handling', () => {
  it('rejects when the API route fails', async () => {
    (apiRoutes.customerWaiterCalls.create as any).mockRejectedValueOnce(new Error('Create failed'));

    const { result } = renderHookWithProviders(() => useCreateWaiterCall());

    await expect(
      result.current.mutateAsync({
        tableId: 'table-1',
        callType: 'assistance',
        reason: 'Help',
        priority: 'normal',
      }),
    ).rejects.toThrow('Create failed');
  });
});
