export const mockAdminStaff = {
  id: 'staff-admin-1',
  tenant_id: 'test-tenant-id',
  full_name: 'Test Admin',
  role: 'admin' as const,
  email: 'admin@test.com',
  is_active: true,
  auth_user_id: 'auth-user-1',
  phone: null,
  last_login_at: null,
  preferred_language: 'en',
  push_token: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockWaiterStaff = {
  ...mockAdminStaff,
  id: 'staff-waiter-1',
  full_name: 'Test Waiter',
  role: 'waiter' as const,
  email: 'waiter@test.com',
  auth_user_id: 'auth-user-2',
};

export function mockUseAuth(overrides: Record<string, unknown> = {}) {
  return {
    staff: mockAdminStaff,
    isLoading: false,
    isAuthenticated: true,
    logout: vi.fn(),
    ...overrides,
  };
}
