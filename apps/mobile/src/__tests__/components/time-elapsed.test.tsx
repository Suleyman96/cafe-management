import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native-paper', () => ({
  Text: ({ children, style, ...props }: any) => (
    <span data-testid="elapsed" style={style} {...props}>
      {children}
    </span>
  ),
  // `TextInput` (and its sub-components) is destructured by `paper-compat`
  // — re-exported from the `@gustri/ui-mobile` barrel. Provide passthrough
  // stubs so the barrel evaluation doesn't blow up. Tests don't use it.
  TextInput: Object.assign(({ children }: any) => <span>{children}</span>, {
    Icon: ({ children }: any) => <span>{children}</span>,
    Affix: ({ children }: any) => <span>{children}</span>,
  }),
  MD3LightTheme: { colors: {} },
  MD3DarkTheme: { colors: {} },
}));

import { TimeElapsed } from '@gustri/ui-mobile';
import { __resetNowStoreForTests, useNowStore } from '@/lib/now-store';

describe('TimeElapsed component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetNowStoreForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    __resetNowStoreForTests();
  });

  it('renders initial elapsed time in seconds', () => {
    const now = new Date('2026-03-27T12:00:30Z');
    vi.setSystemTime(now);
    useNowStore.setState({ now: now.getTime() });

    const { getByTestId } = render(<TimeElapsed createdAt="2026-03-27T12:00:00Z" />);

    expect(getByTestId('elapsed').textContent).toBe('30s');
  });

  it('updates from seconds to minutes when the shared tick advances past 60s', () => {
    const start = new Date('2026-03-27T12:00:50Z');
    vi.setSystemTime(start);
    useNowStore.setState({ now: start.getTime() });

    const { getByTestId } = render(<TimeElapsed createdAt="2026-03-27T12:00:00Z" />);
    expect(getByTestId('elapsed').textContent).toBe('50s');

    act(() => {
      const next = start.getTime() + 15_000;
      vi.setSystemTime(new Date(next));
      useNowStore.setState({ now: next });
    });
    expect(getByTestId('elapsed').textContent).toBe('1m');
  });

  it('does not run a per-component interval (single shared tick drives updates)', () => {
    const now = new Date('2026-03-27T12:00:30Z');
    vi.setSystemTime(now);
    useNowStore.setState({ now: now.getTime() });

    const setIntervalSpy = vi.spyOn(global, 'setInterval');

    render(<TimeElapsed createdAt="2026-03-27T12:00:00Z" />);
    render(<TimeElapsed createdAt="2026-03-27T12:00:00Z" />);
    render(<TimeElapsed createdAt="2026-03-27T12:00:00Z" />);

    // Three mounts → still exactly one shared interval started.
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    setIntervalSpy.mockRestore();
  });

  it('clears the shared interval only when the last consumer unmounts', () => {
    const now = new Date('2026-03-27T12:00:30Z');
    vi.setSystemTime(now);
    useNowStore.setState({ now: now.getTime() });

    const clearSpy = vi.spyOn(global, 'clearInterval');

    const a = render(<TimeElapsed createdAt="2026-03-27T12:00:00Z" />);
    const b = render(<TimeElapsed createdAt="2026-03-27T12:00:00Z" />);

    a.unmount();
    expect(clearSpy).not.toHaveBeenCalled();

    b.unmount();
    expect(clearSpy).toHaveBeenCalledTimes(1);

    clearSpy.mockRestore();
  });

  it('applies red color when elapsed >= 20 minutes', () => {
    const now = new Date('2026-03-27T12:20:00Z');
    vi.setSystemTime(now);
    useNowStore.setState({ now: now.getTime() });

    const { getByTestId } = render(<TimeElapsed createdAt="2026-03-27T12:00:00Z" />);

    const el = getByTestId('elapsed');
    expect(el.textContent).toBe('20m');
    expect(el.style.color).toBe('rgb(239, 68, 68)');
    expect(el.style.fontWeight).toBe('700');
  });
});
