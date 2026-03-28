import '@testing-library/jest-dom';
import { createMockDb } from './helpers/mock-db';

// Mock Supabase module (prevents real client initialization)
vi.mock('@/lib/supabase', () => ({
  db: createMockDb(),
  supabase: {
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
  },
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn().mockReturnValue({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: vi.fn().mockReturnValue('/'),
  useSearchParams: vi.fn().mockReturnValue(new URLSearchParams()),
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock i18n — returns translation keys as-is for test assertions
vi.mock('@gustri/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, any>) => {
      if (opts) {
        // Return key with interpolated values for assertions
        return `${key}:${JSON.stringify(opts)}`;
      }
      return key;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initI18n: vi.fn(),
}));

// Mock next/image — render as plain img
vi.mock('next/image', () => ({
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    const { fill, priority, ...rest } = props;
    return rest;
  },
}));

// Clear all mock call counts between tests
beforeEach(() => {
  vi.clearAllMocks();
});
