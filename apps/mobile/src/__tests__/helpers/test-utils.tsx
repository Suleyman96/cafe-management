import type { SupabaseWrapper } from '@gustri/api-client';
import { DbProvider } from '@gustri/queries';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/store/auth-store';
import type { Staff } from '@/types';
import { createMockDb } from './mock-db';

/**
 * Default staff fixture used to seed the auth store in tests so hooks gated
 * on `tenant_id` (e.g. `useTables`) actually fire. Override per-test via
 * `seedAuth({ ... })` if a test needs a different identity.
 */
const TEST_TENANT_ID = '00000000-0000-0000-0000-0000000000aa';
const TEST_STAFF_ID = '00000000-0000-0000-0000-0000000000bb';

export const TEST_STAFF: Staff = {
  id: TEST_STAFF_ID,
  tenant_id: TEST_TENANT_ID,
  email: 'admin@test.com',
  full_name: 'Test Admin',
  role: 'admin',
  phone: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  last_login_at: null,
  auth_user_id: null,
  preferred_language: 'en',
};

export function seedAuth(staff: Staff | null = TEST_STAFF) {
  useAuthStore.setState({ staff, isLoading: false });
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function createWrapper() {
  // Seed auth store so tenant-id-gated queries (e.g. useTables) run.
  seedAuth();
  const queryClient = createTestQueryClient();
  const mockDb = createMockDb() as unknown as SupabaseWrapper;
  return {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <DbProvider db={mockDb}>{children}</DbProvider>
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
