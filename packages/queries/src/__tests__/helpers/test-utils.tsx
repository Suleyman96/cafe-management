import type { SupabaseWrapper } from '@gustri/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DbProvider } from '../../provider';
import { createMockDb } from './mock-db';

/**
 * Stable tenant id used by the test wrapper. Tests that assert on query
 * keys should compose them with `tenantKey(TEST_TENANT_ID, …)` so the
 * assertion matches what the production hook actually wrote.
 */
export const TEST_TENANT_ID = 'test-tenant';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function createWrapper() {
  const queryClient = createTestQueryClient();
  const mockDb = createMockDb() as unknown as SupabaseWrapper;
  return {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <DbProvider db={mockDb} tenantId={TEST_TENANT_ID}>
          {children}
        </DbProvider>
      </QueryClientProvider>
    ),
    queryClient,
    mockDb,
  };
}

export function renderHookWithProviders<T>(hook: () => T) {
  const { wrapper, queryClient, mockDb } = createWrapper();
  return {
    ...renderHook(hook, { wrapper }),
    queryClient,
    mockDb,
  };
}
