import {
  MutationObserver,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  View: ({ children, style, ...props }: any) => (
    <div style={style} {...props}>
      {children}
    </div>
  ),
  Text: ({ children, style, ...props }: any) => (
    <span data-testid="badge-text" style={style} {...props}>
      {children}
    </span>
  ),
  StyleSheet: { create: <T extends Record<string, unknown>>(s: T) => s },
}));

vi.mock('@gustri/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number }) =>
      opts?.count !== undefined ? `${opts.count} pending` : key,
  }),
}));

import { PendingSyncBadge } from '@/components/PendingSyncBadge';

function makeClient() {
  return new QueryClient({
    defaultOptions: { mutations: { retry: false, networkMode: 'online' } },
  });
}

function wrap(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('PendingSyncBadge', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
    cleanup();
  });

  it('renders nothing when no mutations are paused', () => {
    const client = makeClient();
    const { queryByTestId } = render(<PendingSyncBadge />, { wrapper: wrap(client) });
    expect(queryByTestId('badge-text')).toBeNull();
  });

  it('does NOT count in-flight mutations (regression — old code used status: pending)', async () => {
    const client = makeClient();
    const { queryByTestId } = render(<PendingSyncBadge />, { wrapper: wrap(client) });

    // An in-flight mutation has React Query status === 'pending' but
    // isPaused === false. The fixed badge filters on isPaused, so this
    // must not render.
    const observer = new MutationObserver(client, {
      mutationFn: () =>
        new Promise<void>((r) => {
          setTimeout(r, 50);
        }),
    });
    await act(async () => {
      void observer.mutate();
    });

    expect(queryByTestId('badge-text')).toBeNull();

    // Drain — wait for mutation to settle so the test exits cleanly.
    await waitFor(() => {
      expect(observer.getCurrentResult().status).toBe('success');
    });
  });

  it('counts paused (offline-queued) mutations', async () => {
    const client = makeClient();
    const { queryByTestId } = render(<PendingSyncBadge />, { wrapper: wrap(client) });

    // Force offline so a `networkMode: 'online'` mutation enters the
    // paused state instead of executing — exactly the production scenario
    // the badge is meant to surface.
    onlineManager.setOnline(false);

    const observer = new MutationObserver(client, {
      mutationFn: () => Promise.resolve('ok'),
    });
    await act(async () => {
      void observer.mutate();
    });

    await waitFor(() => {
      expect(queryByTestId('badge-text')?.textContent).toBe('1 pending');
    });
  });
});
