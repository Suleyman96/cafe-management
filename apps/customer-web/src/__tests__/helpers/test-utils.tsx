import type { SupabaseWrapper } from '@gustri/api-client';
import { DbProvider } from '@gustri/queries';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
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
  const mockDb = createMockDb() as unknown as SupabaseWrapper;
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
  const mockDb = createMockDb() as unknown as SupabaseWrapper;
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
