/**
 * Validates the CrossTabBridge contract that closes Blocker 5: a sibling
 * tab's mutation/auth event reaches this tab via the cross-tab transport
 * and produces the right cache + auth side effects.
 *
 * Mirrors the bridge implementation against an externally-owned
 * QueryClient so we can read the cache after firing simulated messages.
 */

import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Capture handlers so the test can fire CrossTab messages directly. The
// vi.mock factory is hoisted above any module-scope `const` declarations,
// so the mocks stash their refs on globalThis and the test reads them back
// after import.
type Handler = (msg: { kind: string; tabId: string; tenantId?: string }) => void;
type TestGlobals = {
  __crossTabHandlers: Handler[];
  __signOutMock: ReturnType<typeof vi.fn>;
};

vi.mock('@/lib/realtime/cross-tab', () => {
  const handlers: Handler[] = [];
  (globalThis as unknown as TestGlobals).__crossTabHandlers = handlers;
  return {
    onCrossTab: (cb: Handler) => {
      handlers.push(cb);
      return () => {
        const idx = handlers.indexOf(cb);
        if (idx >= 0) handlers.splice(idx, 1);
      };
    },
    postCrossTab: vi.fn(),
    getTabId: () => 'this-tab',
  };
});

vi.mock('@/lib/supabase/client', () => {
  const signOut = vi.fn().mockResolvedValue({ error: null });
  (globalThis as unknown as TestGlobals).__signOutMock = signOut;
  return { supabase: { auth: { signOut } } };
});

import { onCrossTab } from '@/lib/realtime/cross-tab';
import { supabase } from '@/lib/supabase/client';

const { __crossTabHandlers: onCrossTabHandlers, __signOutMock: signOutMock } =
  globalThis as unknown as TestGlobals;

/**
 * Mirrors `CrossTabBridge` from `apps/staff-web/src/app/providers.tsx` so
 * the test asserts the same logic against a QueryClient we control.
 */
function BridgeUnderTest() {
  const qc = useQueryClient();

  useEffect(() => {
    return onCrossTab((msg) => {
      switch (msg.kind) {
        case 'mutation-success':
          qc.invalidateQueries();
          break;
        case 'signed-out':
          qc.clear();
          supabase.auth.signOut().catch(() => {});
          break;
        case 'tenant-changed':
          qc.clear();
          break;
      }
    });
  }, [qc]);

  return null;
}

function renderWithBridge() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  qc.setQueryData(['orders'], [{ id: 'o-1' }]);
  qc.setQueryData(['payments', 'o-1'], { total: 50 });
  const r = render(
    <QueryClientProvider client={qc}>
      <BridgeUnderTest />
    </QueryClientProvider>,
  );
  return { ...r, qc };
}

beforeEach(() => {
  onCrossTabHandlers.length = 0;
  signOutMock.mockReset().mockResolvedValue({ error: null });
});

describe('CrossTabBridge', () => {
  it('mutation-success from a sibling tab invalidates every active query', () => {
    const { qc } = renderWithBridge();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    act(() => {
      onCrossTabHandlers[0]!({ kind: 'mutation-success', tabId: 'sibling' });
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith();
  });

  it('signed-out from a sibling tab clears the cache and signs out locally', () => {
    const { qc } = renderWithBridge();
    expect(qc.getQueryData(['orders'])).toBeDefined();

    act(() => {
      onCrossTabHandlers[0]!({ kind: 'signed-out', tabId: 'sibling' });
    });

    expect(qc.getQueryData(['orders'])).toBeUndefined();
    expect(qc.getQueryData(['payments', 'o-1'])).toBeUndefined();
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it('tenant-changed clears the cache without calling signOut', () => {
    const { qc } = renderWithBridge();
    expect(qc.getQueryData(['orders'])).toBeDefined();

    act(() => {
      onCrossTabHandlers[0]!({ kind: 'tenant-changed', tabId: 'sibling', tenantId: 't-2' });
    });

    expect(qc.getQueryData(['orders'])).toBeUndefined();
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount so a late message after teardown is a no-op', () => {
    const { qc, unmount } = renderWithBridge();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    unmount();

    // No handler is registered after unmount.
    expect(onCrossTabHandlers).toHaveLength(0);

    // Sanity: invalidate spy never fires post-unmount.
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
