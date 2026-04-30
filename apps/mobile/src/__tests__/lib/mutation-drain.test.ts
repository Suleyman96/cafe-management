import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { drainMismatchedMutations } from '@/lib/mutation-drain';

function pushMutation(queryClient: QueryClient, meta: Record<string, unknown> | undefined) {
  const cache = queryClient.getMutationCache();
  cache.build(queryClient, {
    mutationKey: ['test'],
    mutationFn: async () => null,
    meta,
  });
}

describe('drainMismatchedMutations', () => {
  it('removes mutations whose tenant/staff stamp does not match the current session', () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    pushMutation(queryClient, { tenantId: 'T_A', staffId: 'S_A' });
    pushMutation(queryClient, { tenantId: 'T_B', staffId: 'S_B' });

    const discarded = drainMismatchedMutations(queryClient, {
      tenantId: 'T_B',
      staffId: 'S_B',
    });

    expect(discarded).toBe(1);
    const remaining = queryClient.getMutationCache().getAll();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.meta).toEqual({ tenantId: 'T_B', staffId: 'S_B' });
  });

  it('removes every mutation when no current session is provided', () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    pushMutation(queryClient, { tenantId: 'T_A', staffId: 'S_A' });
    pushMutation(queryClient, { tenantId: 'T_B', staffId: 'S_B' });

    const discarded = drainMismatchedMutations(queryClient, null);

    expect(discarded).toBe(2);
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
  });

  it('removes mutations with no stamp (cannot prove origin)', () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    pushMutation(queryClient, undefined);
    pushMutation(queryClient, { tenantId: 'T_A', staffId: 'S_A' });

    const discarded = drainMismatchedMutations(queryClient, {
      tenantId: 'T_A',
      staffId: 'S_A',
    });

    expect(discarded).toBe(1);
    const remaining = queryClient.getMutationCache().getAll();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.meta).toEqual({ tenantId: 'T_A', staffId: 'S_A' });
  });

  it('keeps every mutation when all stamps match', () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    pushMutation(queryClient, { tenantId: 'T_A', staffId: 'S_A' });
    pushMutation(queryClient, { tenantId: 'T_A', staffId: 'S_A' });

    const discarded = drainMismatchedMutations(queryClient, {
      tenantId: 'T_A',
      staffId: 'S_A',
    });

    expect(discarded).toBe(0);
    expect(queryClient.getMutationCache().getAll()).toHaveLength(2);
  });
});
