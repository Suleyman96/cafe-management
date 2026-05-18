import type { SupabaseWrapper } from '@gustri/api-client';
import { DbProvider } from '@gustri/queries';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
// Reuse the same mockDb instance that `@/lib/supabase` is mocked to in
// setup.ts. Without this, the DbProvider wraps children with a *fresh*
// mockDb while raw `db` consumers (use-table, etc.) see the
// setup.ts singleton — same logical wrapper but two different mock
// instances, so a test's `(db.X.method as any).mockResolvedValueOnce(...)`
// is invisible to any hook that goes through the provider
// (`useDb()` → useMenuItems, useCategories, etc.). Pulling the same
// db keeps the contract single-instance across both consumer paths.
import { db as globalMockDb } from '@/lib/supabase';
import { createMockDb } from './mock-db';

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
  const mockDb = globalMockDb as unknown as SupabaseWrapper;
  return {
    // eslint-disable-next-line -- wrapper type mismatch between @testing-library/react and @types/react 18.3
    wrapper: (({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <DbProvider db={mockDb}>{children}</DbProvider>
      </QueryClientProvider>
    )) as any,
    queryClient,
    mockDb,
  };
}

export function renderWithProviders(ui: ReactElement) {
  const queryClient = createTestQueryClient();
  const mockDb = globalMockDb as unknown as SupabaseWrapper;
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <DbProvider db={mockDb}>{ui}</DbProvider>
      </QueryClientProvider>,
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

// Re-export testing-library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
// Some tests want a fresh, isolated mockDb (e.g. for asserting
// per-test call counts on something that's stateful across renders).
// They can opt in by passing this helper to a custom render flow.
export { createMockDb };
