import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Same heavy-deps stub-out as `auth-cleanup.test.ts` — auth.ts pulls in
// expo-constants / AsyncStorage / MMKV via its transitive imports.
vi.mock('@/lib/query-persister', () => ({
  asyncStoragePersister: { removeClient: vi.fn().mockResolvedValue(undefined) },
  clearEncryptedQueryCache: vi.fn(),
}));

vi.mock('@/lib/query-client', () => ({
  queryClient: {
    cancelQueries: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
  },
}));

vi.mock('@/hooks/use-push-token-sync', () => ({
  clearPushTokenSyncCache: vi.fn(),
  readLastSyncedExpoToken: vi.fn().mockReturnValue(null),
}));

vi.mock('@/lib/pending-revokes', () => ({
  enqueuePendingRevoke: vi.fn(),
  drainPendingRevokes: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/lib/last-active-at', () => ({
  clearLastActiveAt: vi.fn(),
}));

vi.mock('@/lib/session-stamp', () => ({
  clearSessionStamp: vi.fn(),
}));

// `vi.mock` factories are hoisted above all imports — use `vi.hoisted` to
// share state between the factory and the test body.
const { mockFindByAuthId, capturedHandlers } = vi.hoisted(() => {
  type AuthStateHandler = (
    event: string,
    session: { user: { id: string } } | null,
  ) => Promise<void>;
  return {
    mockFindByAuthId: vi.fn().mockResolvedValue({
      id: 'staff-1',
      tenant_id: 'tenant-1',
      is_active: true,
    }),
    capturedHandlers: [] as AuthStateHandler[],
  };
});

vi.mock('@/lib/supabase', () => ({
  db: {
    setTenantContext: vi.fn(),
    staff: { findByAuthId: mockFindByAuthId },
  },
  supabase: {
    auth: {
      signOut: vi.fn().mockResolvedValue({}),
      onAuthStateChange: vi.fn(
        (handler: (event: string, session: { user: { id: string } } | null) => Promise<void>) => {
          capturedHandlers.push(handler);
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        },
      ),
    },
    getChannels: vi.fn().mockReturnValue([]),
    removeChannel: vi.fn().mockResolvedValue('ok'),
  },
}));

import { onAuthStateChange } from '@/lib/auth';
// `cancelQueries` + `clear` from the mocked query-client are the marker we
// assert against — `cleanupClientState` calls them, and they're the only
// per-flow-distinguishable side effect from inside the H6 gate.
import { queryClient } from '@/lib/query-client';

describe('onAuthStateChange — H6 defensive cache flush', () => {
  beforeEach(() => {
    capturedHandlers.length = 0;
    vi.mocked(queryClient.cancelQueries).mockClear();
    vi.mocked(queryClient.clear).mockClear();
    mockFindByAuthId.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function register() {
    const callback = vi.fn();
    onAuthStateChange(callback);
    const handler = capturedHandlers[capturedHandlers.length - 1];
    if (!handler) throw new Error('Auth state handler was not registered');
    return { handler, callback };
  }

  it('clears the cache on SIGNED_IN even when lastUserId is null (post-SIGNED_OUT path)', async () => {
    const { handler } = register();

    await handler('SIGNED_IN', { user: { id: 'user-A' } });

    // cleanupClientState fires → cancelQueries + clear are called.
    expect(queryClient.cancelQueries).toHaveBeenCalled();
    expect(queryClient.clear).toHaveBeenCalled();
  });

  it('does NOT clear on INITIAL_SESSION when lastUserId is null (boot restore is pre-vetted)', async () => {
    const { handler } = register();

    await handler('INITIAL_SESSION', { user: { id: 'user-A' } });

    // Trust the App.tsx pre-hydration check; don't defeat offline-first
    // by clearing the persister we just hydrated.
    expect(queryClient.cancelQueries).not.toHaveBeenCalled();
    expect(queryClient.clear).not.toHaveBeenCalled();
  });

  it('does NOT clear on TOKEN_REFRESHED for the same user', async () => {
    const { handler } = register();

    // Establish lastUserId via INITIAL_SESSION (no clear).
    await handler('INITIAL_SESSION', { user: { id: 'user-A' } });
    vi.mocked(queryClient.cancelQueries).mockClear();
    vi.mocked(queryClient.clear).mockClear();

    // Token refresh — same user, must not churn the cache.
    await handler('TOKEN_REFRESHED', { user: { id: 'user-A' } });

    expect(queryClient.cancelQueries).not.toHaveBeenCalled();
    expect(queryClient.clear).not.toHaveBeenCalled();
  });

  it('clears on mid-session user switch (existing tenant-transition contract)', async () => {
    const { handler } = register();

    await handler('INITIAL_SESSION', { user: { id: 'user-A' } });
    vi.mocked(queryClient.cancelQueries).mockClear();
    vi.mocked(queryClient.clear).mockClear();

    // TOKEN_REFRESHED with a different user-id — exotic but possible if a
    // server-side admin action swapped the auth.users row. Treat as a
    // transition.
    await handler('TOKEN_REFRESHED', { user: { id: 'user-B' } });

    expect(queryClient.cancelQueries).toHaveBeenCalled();
    expect(queryClient.clear).toHaveBeenCalled();
  });

  it('clears on SIGNED_OUT (existing teardown — regression guard for SIGNED_OUT path)', async () => {
    const { handler } = register();

    await handler('INITIAL_SESSION', { user: { id: 'user-A' } });
    vi.mocked(queryClient.cancelQueries).mockClear();
    vi.mocked(queryClient.clear).mockClear();

    await handler('SIGNED_OUT', null);

    expect(queryClient.cancelQueries).toHaveBeenCalled();
    expect(queryClient.clear).toHaveBeenCalled();
  });
});
