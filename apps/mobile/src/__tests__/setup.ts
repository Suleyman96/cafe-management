import { createMockDb } from './helpers/mock-db';

// Mock Supabase module (prevents real client initialization)
vi.mock('@/lib/supabase', () => ({
  db: createMockDb(),
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({}),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
  },
}));

// Mock API routes (prevents real fetch calls and expo-constants import)
vi.mock('@/lib/api-routes', () => ({
  apiRoutes: {
    orders: {
      create: vi.fn().mockResolvedValue({ order: { id: 'test-order-id' } }),
    },
    payments: {
      create: vi.fn().mockResolvedValue({ payment: { id: 'test-payment-id' } }),
    },
    discounts: {
      apply: vi.fn().mockResolvedValue({ success: true }),
    },
    refunds: {
      create: vi.fn().mockResolvedValue({ refund: { id: 'test-refund-id' } }),
    },
    stock: {
      adjust: vi.fn().mockResolvedValue({ stockItem: { id: 'test-stock-id' } }),
    },
    settings: {
      update: vi.fn().mockResolvedValue({ settings: {} }),
    },
  },
}));

// Clear all mock call counts between tests
beforeEach(() => {
  vi.clearAllMocks();
});
