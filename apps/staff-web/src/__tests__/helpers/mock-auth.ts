export const mockAdminStaff = {
  id: 'staff-admin-1',
  full_name: 'Test Admin',
  role: 'admin',
  email: 'admin@test.com',
  is_active: true,
  auth_user_id: 'auth-user-1',
  phone: null,
  last_login_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockWaiterStaff = {
  ...mockAdminStaff,
  id: 'staff-waiter-1',
  full_name: 'Test Waiter',
  role: 'waiter',
  email: 'waiter@test.com',
  auth_user_id: 'auth-user-2',
};

export function mockUseAuth(overrides: Record<string, any> = {}) {
  return {
    staff: mockAdminStaff,
    isLoading: false,
    isAuthenticated: true,
    logout: vi.fn(),
    ...overrides,
  };
}
