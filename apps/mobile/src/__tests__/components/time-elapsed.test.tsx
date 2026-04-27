import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock react-native-paper's Text to render in jsdom
vi.mock('react-native-paper', () => ({
  Text: ({ children, style, ...props }: any) => (
    <span data-testid="elapsed" style={style} {...props}>
      {children}
    </span>
  ),
  MD3LightTheme: { colors: {} },
  MD3DarkTheme: { colors: {} },
}));

import { TimeElapsed } from '@/components/ui/TimeElapsed';

describe('TimeElapsed component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('renders initial elapsed time in seconds', () => {
    const now = new Date('2026-03-27T12:00:30Z');
    vi.setSystemTime(now);

    const { getByTestId } = render(<TimeElapsed createdAt="2026-03-27T12:00:00Z" />);

    expect(getByTestId('elapsed').textContent).toBe('30s');
  });

  it('updates from seconds to minutes after crossing 60s', () => {
    const now = new Date('2026-03-27T12:00:50Z');
    vi.setSystemTime(now);

    const { getByTestId } = render(<TimeElapsed createdAt="2026-03-27T12:00:00Z" />);

    expect(getByTestId('elapsed').textContent).toBe('50s');

    // Advance 15s → 65s total → should show 1m
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(getByTestId('elapsed').textContent).toBe('1m');
  });

  it('switches interval from 1s to 60s after first minute', () => {
    const now = new Date('2026-03-27T12:00:55Z');
    vi.setSystemTime(now);

    const clearSpy = vi.spyOn(global, 'clearInterval');

    render(<TimeElapsed createdAt="2026-03-27T12:00:00Z" />);

    // Advance past 60s — tick fires at 1s intervals, one tick crosses the minute threshold
    vi.advanceTimersByTime(6000);

    // clearInterval should have been called to switch from 1s to 60s interval
    expect(clearSpy).toHaveBeenCalled();

    clearSpy.mockRestore();
  });

  it('cleans up interval on unmount', () => {
    const now = new Date('2026-03-27T12:00:30Z');
    vi.setSystemTime(now);

    const clearSpy = vi.spyOn(global, 'clearInterval');

    const { unmount } = render(<TimeElapsed createdAt="2026-03-27T12:00:00Z" />);

    unmount();
    expect(clearSpy).toHaveBeenCalled();

    clearSpy.mockRestore();
  });

  it('applies red color when elapsed >= 20 minutes', () => {
    const now = new Date('2026-03-27T12:20:00Z');
    vi.setSystemTime(now);

    const { getByTestId } = render(<TimeElapsed createdAt="2026-03-27T12:00:00Z" />);

    const el = getByTestId('elapsed');
    expect(el.textContent).toBe('20m');
    // jsdom converts hex to rgb
    expect(el.style.color).toBe('rgb(239, 68, 68)');
    expect(el.style.fontWeight).toBe('700');
  });
});
