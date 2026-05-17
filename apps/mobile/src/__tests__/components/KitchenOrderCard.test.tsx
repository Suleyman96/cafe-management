import { MUTATION_KEYS } from '@gustri/queries';
import { MutationObserver, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => {
  const View = ({ children, style, ...props }: any) => (
    <div style={style} {...props}>
      {children}
    </div>
  );
  // KitchenOrderCard uses `Animated.View` for the new-order pulse loop and
  // `new Animated.Value(...)` to drive opacity. The pulse itself is not
  // under test here, so we shim Animated to no-op shapes that render
  // through the regular `<div>` View used above.
  class AnimatedValue {
    setValue() {}
  }
  const noopAnimation = { start: () => {}, stop: () => {} };
  return {
    View,
    Text: ({ children, style, ...props }: any) => (
      <span style={style} {...props}>
        {children}
      </span>
    ),
    TouchableOpacity: ({ children, onPress, disabled, accessibilityLabel, ...rest }: any) => (
      <button
        type="button"
        onClick={onPress}
        disabled={!!disabled}
        aria-label={accessibilityLabel}
        data-disabled={disabled ? 'true' : 'false'}
        {...rest}
      >
        {children}
      </button>
    ),
    ActivityIndicator: () => <span>spinner</span>,
    StyleSheet: { create: <T extends Record<string, unknown>>(s: T) => s },
    Animated: {
      View,
      Value: AnimatedValue,
      timing: () => noopAnimation,
      sequence: () => noopAnimation,
      loop: () => noopAnimation,
    },
  };
});

vi.mock('@gustri/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'number' in opts) return `Table ${opts.number}`;
      if (key === 'kitchen.ready') return 'Ready';
      if (key === 'kitchen.unknownItem') return 'Unknown';
      if (key === 'kitchen.startPreparing') return 'Start Preparing';
      if (key === 'kitchen.allReady') return 'All Ready';
      if (key === 'kitchen.allServed') return 'All Served';
      if (key === 'kitchen.takeout') return 'Takeout';
      if (key === 'kitchen.delivery') return 'Delivery';
      return key;
    },
  }),
}));

vi.mock('@/components/ui', () => ({
  StatusBadge: ({ status }: { status: string }) => <span>status:{status}</span>,
  TimeElapsed: ({ createdAt }: { createdAt: string }) => <span>time:{createdAt}</span>,
}));

vi.mock('@/theme', () => ({
  BRAND_PRIMARY: '#000',
  CARD_PADDING: 12,
  CARD_RADIUS: 8,
  COLORS: { warning: '#f00', success: '#0f0', textMuted: '#888' },
  ORDER_STATUS_COLORS: { preparing: { text: '#0f0' } },
}));

import { KitchenOrderCard } from '@/components/kitchen/KitchenOrderCard';

const baseOrder = {
  id: 'order-1',
  order_number: '42',
  status: 'preparing',
  created_at: '2026-05-08T10:00:00Z',
  table: { table_number: '5' },
  order_items: [
    {
      id: 'item-a',
      quantity: 1,
      status: 'preparing',
      menu_item: { name: 'Pizza' },
    },
    {
      id: 'item-b',
      quantity: 2,
      status: 'preparing',
      menu_item: { name: 'Salad' },
    },
  ],
};

const noop = () => {};

function readyButtons(container: HTMLElement) {
  // Per-item "Ready" buttons label themselves with " — <item>"; order-level
  // action buttons (Start Preparing / All Ready / All Served) don't.
  return Array.from(container.querySelectorAll('button')).filter((b) =>
    (b.getAttribute('aria-label') || '').startsWith('Ready —'),
  );
}

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false, networkMode: 'always' },
    },
  });
}

function wrap(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('KitchenOrderCard — H2 per-item disable via useIsMutating', () => {
  afterEach(() => {
    cleanup();
  });

  it('disables only the row whose itemId matches an in-flight mutation', async () => {
    const client = makeClient();

    // Register an in-flight `update-order-item-status` mutation targeting
    // item-a. The row reads `useIsMutating` directly from the cache, so its
    // disabled state must flip without any parent state being passed in.
    let resolveMutation!: () => void;
    const observer = new MutationObserver(client, {
      mutationKey: MUTATION_KEYS.UPDATE_ORDER_ITEM_STATUS,
      mutationFn: () =>
        new Promise<void>((r) => {
          resolveMutation = r;
        }),
    });
    await act(async () => {
      void observer.mutate({ itemId: 'item-a', status: 'ready' });
    });

    const { container } = render(
      <KitchenOrderCard
        order={baseOrder}
        onStartPreparing={noop}
        onMarkItemReady={noop}
        onMarkAllReady={noop}
        onMarkAllServed={noop}
      />,
      { wrapper: wrap(client) },
    );

    const buttons = readyButtons(container);
    const a = buttons.find((b) => b.getAttribute('aria-label')?.includes('Pizza'));
    const b = buttons.find((b) => b.getAttribute('aria-label')?.includes('Salad'));

    expect(a?.getAttribute('data-disabled')).toBe('true');
    expect(b?.getAttribute('data-disabled')).toBe('false');

    // Clean up the pending mutation so the test exits.
    await act(async () => {
      resolveMutation();
    });
    await waitFor(() => {
      expect(observer.getCurrentResult().status).toBe('success');
    });
  });

  it('re-enables the row after its mutation settles (no try/finally bookkeeping needed)', async () => {
    const client = makeClient();

    let resolveMutation!: () => void;
    const observer = new MutationObserver(client, {
      mutationKey: MUTATION_KEYS.UPDATE_ORDER_ITEM_STATUS,
      mutationFn: () =>
        new Promise<void>((r) => {
          resolveMutation = r;
        }),
    });
    await act(async () => {
      void observer.mutate({ itemId: 'item-a', status: 'ready' });
    });

    const { container } = render(
      <KitchenOrderCard
        order={baseOrder}
        onStartPreparing={noop}
        onMarkItemReady={noop}
        onMarkAllReady={noop}
        onMarkAllServed={noop}
      />,
      { wrapper: wrap(client) },
    );

    expect(
      readyButtons(container)
        .find((b) => b.getAttribute('aria-label')?.includes('Pizza'))
        ?.getAttribute('data-disabled'),
    ).toBe('true');

    await act(async () => {
      resolveMutation();
    });
    await waitFor(() => {
      expect(observer.getCurrentResult().status).toBe('success');
    });

    await waitFor(() => {
      expect(
        readyButtons(container)
          .find((b) => b.getAttribute('aria-label')?.includes('Pizza'))
          ?.getAttribute('data-disabled'),
      ).toBe('false');
    });
  });

  it('ignores mutations for unrelated keys (predicate scopes by mutation key)', async () => {
    const client = makeClient();

    // A mutation with the SAME variables shape but a different mutationKey
    // (e.g. `create-order` carrying an `itemId`-shaped property by accident)
    // must NOT disable the row. The filter on `MUTATION_KEYS.UPDATE_ORDER_ITEM_STATUS`
    // is what prevents accidental cross-talk.
    let resolveMutation!: () => void;
    const observer = new MutationObserver(client, {
      mutationKey: ['some-unrelated-key'],
      mutationFn: () =>
        new Promise<void>((r) => {
          resolveMutation = r;
        }),
    });
    await act(async () => {
      void observer.mutate({ itemId: 'item-a' });
    });

    const { container } = render(
      <KitchenOrderCard
        order={baseOrder}
        onStartPreparing={noop}
        onMarkItemReady={noop}
        onMarkAllReady={noop}
        onMarkAllServed={noop}
      />,
      { wrapper: wrap(client) },
    );

    const buttons = readyButtons(container);
    expect(buttons).toHaveLength(2);
    for (const btn of buttons) {
      expect(btn.getAttribute('data-disabled')).toBe('false');
    }

    await act(async () => {
      resolveMutation();
    });
    await waitFor(() => {
      expect(observer.getCurrentResult().status).toBe('success');
    });
  });

  it('still disables item buttons during order-level isProcessing (bulk-op safety net)', () => {
    const client = makeClient();
    // No mutation in flight — only the parent-supplied `isProcessing` prop
    // covers bulk-op flows (Start Preparing / All Ready / All Served).
    const { container } = render(
      <KitchenOrderCard
        order={baseOrder}
        onStartPreparing={noop}
        onMarkItemReady={noop}
        onMarkAllReady={noop}
        onMarkAllServed={noop}
        isProcessing
      />,
      { wrapper: wrap(client) },
    );

    const buttons = readyButtons(container);
    expect(buttons).toHaveLength(2);
    for (const btn of buttons) {
      expect(btn.getAttribute('data-disabled')).toBe('true');
    }
  });
});
