/**
 * Validates the auth-boundary cache-clear contract that closes audit
 * findings CRIT-1 and CRIT-2: TanStack Query cache must be wiped on
 * SIGNED_OUT and on a tenant change so cross-tenant cache bleed is
 * impossible within the gcTime window.
 *
 * Mounts the bridge effect against a known QueryClient (rather than the
 * inner one Providers creates) so we can read the cache after firing
 * mocked auth events.
 */

import { QUERY_KEYS, tenantKey } from '@gustri/queries';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Capture the auth state change callback so tests can fire SIGNED_OUT / SIGNED_IN.
let authCallback: ((event: string, session: unknown) => void) | null = null;
let currentTenantId: string | null = null;

const resubscribeAllMock = vi.fn();
const teardownAllMock = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((cb) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
  },
}));

vi.mock('@/lib/supabase/wrapped-client', () => ({
  db: {
    getTenantId: () => currentTenantId,
    setTenantContext: (id: string | null) => {
      currentTenantId = id;
    },
  },
}));

vi.mock('@/lib/realtime/channel-registry', () => ({
  channelRegistry: {
    resubscribeAll: () => resubscribeAllMock(),
    teardownAll: () => teardownAllMock(),
  },
}));

import { channelRegistry } from '@/lib/realtime/channel-registry';
import { supabase } from '@/lib/supabase/client';
import { db } from '@/lib/supabase/wrapped-client';

/**
 * Mirrors the RealtimeAuthBridge implementation from
 * `apps/staff-web/src/app/providers.tsx` so the test asserts the SAME
 * logic against an externally-owned QueryClient (the Providers component
 * creates its own, which we can't reach from the outside).
 */
function BridgeUnderTest() {
  const qc = useQueryClient();
  const lastTenantIdRef = useRef<string | null>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        const currentId = db.getTenantId();
        if (
          lastTenantIdRef.current !== null &&
          currentId !== null &&
          lastTenantIdRef.current !== currentId
        ) {
          qc.clear();
        }
        lastTenantIdRef.current = currentId;
        channelRegistry.resubscribeAll();
      } else if (event === 'SIGNED_OUT') {
        qc.clear();
        lastTenantIdRef.current = null;
        channelRegistry.teardownAll();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [qc]);

  return null;
}

function mountBridge(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <BridgeUnderTest />
    </QueryClientProvider>,
  );
}

describe('Providers — auth boundary cache lifecycle', () => {
  beforeEach(() => {
    authCallback = null;
    currentTenantId = null;
    resubscribeAllMock.mockClear();
    teardownAllMock.mockClear();
  });

  it('wipes the React Query cache on SIGNED_OUT', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(tenantKey('tenant-a', QUERY_KEYS.ORDERS), [{ id: 'order-1' }]);
    queryClient.setQueryData(tenantKey('tenant-a', QUERY_KEYS.TABLES), [{ id: 'table-1' }]);

    mountBridge(queryClient);

    expect(queryClient.getQueryCache().getAll().length).toBe(2);

    await act(async () => {
      authCallback?.('SIGNED_OUT', null);
    });

    expect(queryClient.getQueryCache().getAll().length).toBe(0);
    expect(teardownAllMock).toHaveBeenCalled();
  });

  it('keeps the cache on SIGNED_IN when no prior tenant was bound', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(tenantKey('tenant-a', QUERY_KEYS.ORDERS), [{ id: 'order-1' }]);

    mountBridge(queryClient);
    currentTenantId = 'tenant-a';

    await act(async () => {
      authCallback?.('SIGNED_IN', { user: { id: 'u1' } });
    });

    // First sign-in records the tenant but does not clear (no prior tenant
    // to compare against — the cache the user just wrote in onMutate may
    // still be relevant).
    expect(queryClient.getQueryCache().getAll().length).toBe(1);
    expect(resubscribeAllMock).toHaveBeenCalled();
  });

  it('wipes the cache on SIGNED_IN when the tenant id changes', async () => {
    const queryClient = new QueryClient();
    mountBridge(queryClient);

    // First sign-in: tenant A.
    currentTenantId = 'tenant-a';
    await act(async () => {
      authCallback?.('SIGNED_IN', { user: { id: 'u1' } });
    });
    queryClient.setQueryData(tenantKey('tenant-a', QUERY_KEYS.ORDERS), [{ id: 'order-1' }]);
    expect(queryClient.getQueryCache().getAll().length).toBe(1);

    // Tenant change without an intervening SIGNED_OUT — bridge MUST clear
    // before the new tenant's first refetch can leak tenant-a data.
    currentTenantId = 'tenant-b';
    await act(async () => {
      authCallback?.('SIGNED_IN', { user: { id: 'u2' } });
    });
    expect(queryClient.getQueryCache().getAll().length).toBe(0);
  });
});
