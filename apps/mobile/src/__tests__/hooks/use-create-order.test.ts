import { describe, expect, it, vi } from 'vitest';
import { useAddOrderItems, useCreateOrder } from '@/hooks/use-create-order';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useCreateOrder', () => {
  it('invalidates orders and tables on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateOrder());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({
      tenant_id: '00000000-0000-0000-0000-000000000001',
      table_id: '00000000-0000-0000-0000-0000000000a1',
      order_type: 'dine_in',
      source: 'waiter',
    });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['orders']);
    expect(keys).toContainEqual(['tables']);
  });
});

describe('useAddOrderItems', () => {
  it('invalidates orders on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useAddOrderItems());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync([]);

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['orders']);
  });
});
