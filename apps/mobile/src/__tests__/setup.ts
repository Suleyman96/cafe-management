import { createMockDb } from './helpers/mock-db';

// Mock haptics module so hooks importing @/lib/haptics don't pull in
// expo-modules-core (which needs `__DEV__` and a native runtime).
vi.mock('@/lib/haptics', () => ({
  hapticEvent: vi.fn(),
  hapticSuccess: vi.fn(),
}));

// In-memory expo-secure-store mock. Both functions are async in real life;
// keep that contract so callers awaiting them behave identically.
vi.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

// expo-crypto mock — getRandomBytesAsync returns deterministic-but-shaped
// bytes so encryption-key generation tests can assert hex round-tripping.
vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: vi.fn(async (length: number) => {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) bytes[i] = i & 0xff;
    return bytes;
  }),
}));

// In-memory MMKV mock — react-native-mmkv is JSI-backed and unavailable in
// jsdom. Each `new MMKV({ id })` returns an isolated Map-backed store with
// the subset of methods we use in app code.
vi.mock('react-native-mmkv', () => {
  class MMKV {
    private store = new Map<string, string | number | boolean>();
    set(key: string, value: string | number | boolean) {
      this.store.set(key, value);
    }
    getString(key: string): string | undefined {
      const v = this.store.get(key);
      return typeof v === 'string' ? v : undefined;
    }
    getNumber(key: string): number | undefined {
      const v = this.store.get(key);
      return typeof v === 'number' ? v : undefined;
    }
    getBoolean(key: string): boolean | undefined {
      const v = this.store.get(key);
      return typeof v === 'boolean' ? v : undefined;
    }
    delete(key: string) {
      this.store.delete(key);
    }
    contains(key: string): boolean {
      return this.store.has(key);
    }
    get size() {
      let total = 0;
      for (const v of this.store.values()) total += String(v).length;
      return total;
    }
    clearAll() {
      this.store.clear();
    }
  }
  return { MMKV };
});

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
    pushTokens: {
      register: vi.fn().mockResolvedValue({ token: { id: 'test-token-id' } }),
      revoke: vi.fn().mockResolvedValue({ revoked: true }),
    },
  },
}));

// Clear all mock call counts between tests
beforeEach(() => {
  vi.clearAllMocks();
});
