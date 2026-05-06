import { act, render } from '@testing-library/react';
import type { RefObject } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FreshnessIndicator } from '@/components/common/freshness-indicator';

/**
 * Plan 12 — last-updated freshness indicator. Verifies the component
 * advances its label as the wall clock progresses, and that the
 * stale (red) tone kicks in once the elapsed window crosses 2 min.
 *
 * The setup mock for `@gustri/i18n` returns the raw key when no English
 * entry exists, so the assertions match on key names rather than localized
 * text. That's fine — the test guards behavior, not copy.
 */

describe('FreshnessIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-06T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a connecting state when no events have been seen', () => {
    const ref: RefObject<number | null> = { current: null };
    const { getByText } = render(<FreshnessIndicator lastEventAtRef={ref} />);
    expect(getByText('freshness.connecting')).toBeInTheDocument();
  });

  it('advances the label as time passes', () => {
    const now = Date.now();
    const ref: RefObject<number | null> = { current: now };

    const { getByText } = render(<FreshnessIndicator lastEventAtRef={ref} />);

    // Just rendered — fresh, "just now".
    expect(getByText('freshness.updated')).toBeInTheDocument();

    // Advance 10 seconds. Component re-renders via its 1-second tick.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    // Still "updated" key (component output combines updated + relative time).
    expect(getByText('freshness.updated')).toBeInTheDocument();
  });

  it('switches to the red/stale tone after >2 min without events', () => {
    const now = Date.now();
    const ref: RefObject<number | null> = { current: now };

    const { container } = render(<FreshnessIndicator lastEventAtRef={ref} />);

    // Under amber threshold — green tone.
    expect(container.querySelector('.text-green-600')).not.toBeNull();

    // Advance past 30s — amber.
    act(() => {
      vi.advanceTimersByTime(35_000);
    });
    expect(container.querySelector('.text-amber-600')).not.toBeNull();

    // Advance past 120s total — red.
    act(() => {
      vi.advanceTimersByTime(90_000);
    });
    expect(container.querySelector('.text-red-600')).not.toBeNull();
  });

  it('clears the tick timer on unmount', () => {
    const ref: RefObject<number | null> = { current: Date.now() };
    const { unmount } = render(<FreshnessIndicator lastEventAtRef={ref} />);
    const before = vi.getTimerCount();
    unmount();
    expect(vi.getTimerCount()).toBeLessThan(before);
  });
});
