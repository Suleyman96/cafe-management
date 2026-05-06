import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdleSoftLock } from '@/components/auth/idle-soft-lock';

// Plan 13 — the soft-lock prompt. Verifies the gate logic without exercising
// the real fetch path: the auth-store and settings hook are mocked so the
// component path under test is the timer + overlay rendering.

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    staff: {
      id: 'staff-1',
      tenant_id: 't-1',
      role: 'admin',
      full_name: 'Aytan',
      email: 'a@b.com',
      pin_set_at: '2026-04-01T00:00:00Z',
    },
    isLoading: false,
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-settings-safe', () => ({
  useCafeSettings: () => ({
    data: { idle_soft_lock_minutes: 60 },
  }),
}));

const mockUseFeatureFlag = vi.fn();
vi.mock('@gustri/queries', async () => {
  const actual = await vi.importActual<typeof import('@gustri/queries')>('@gustri/queries');
  return {
    ...actual,
    useFeatureFlag: (...args: unknown[]) => mockUseFeatureFlag(...args),
  };
});

function withClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

describe('IdleSoftLock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseFeatureFlag.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children and no overlay while idle window is unexpired', () => {
    mockUseFeatureFlag.mockReturnValue(true);
    render(withClient(<IdleSoftLock>child</IdleSoftLock>));
    expect(screen.getByText('child')).toBeInTheDocument();
    expect(screen.queryByLabelText('idleLock.pinLabel')).not.toBeInTheDocument();
  });

  it('shows the PIN prompt after the configured idle window elapses', () => {
    mockUseFeatureFlag.mockReturnValue(true);
    render(withClient(<IdleSoftLock>child</IdleSoftLock>));

    // 60 minutes per the mocked cafe settings — advance just past it.
    act(() => {
      vi.advanceTimersByTime(60 * 60 * 1000 + 100);
    });

    expect(screen.getByLabelText('idleLock.pinLabel')).toBeInTheDocument();
  });

  it('resets the timer on activity', () => {
    mockUseFeatureFlag.mockReturnValue(true);
    render(withClient(<IdleSoftLock>child</IdleSoftLock>));

    // Almost-expire, then nudge with mousemove — overlay must NOT mount.
    act(() => {
      vi.advanceTimersByTime(59 * 60 * 1000);
    });
    act(() => {
      fireEvent.mouseMove(window);
    });
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });
    // 59 + 2 = 61 minutes total wall clock, but the mousemove reset the
    // timer at 59m so only 2m has accumulated since reset — still under
    // the 60m threshold.
    expect(screen.queryByLabelText('idleLock.pinLabel')).not.toBeInTheDocument();
  });

  it('renders nothing extra when the feature flag is off', () => {
    mockUseFeatureFlag.mockReturnValue(false);
    render(withClient(<IdleSoftLock>child</IdleSoftLock>));

    act(() => {
      vi.advanceTimersByTime(60 * 60 * 1000 + 100);
    });
    expect(screen.queryByLabelText('idleLock.pinLabel')).not.toBeInTheDocument();
  });
});
