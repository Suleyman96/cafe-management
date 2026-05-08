import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Heavy-deps stub-out — query-persister.ts pulls expo-constants /
// expo-secure-store / async-storage transitively. Same pattern used by
// auth-cleanup.test.ts.
vi.mock('expo-constants', () => ({
  default: { expoConfig: { version: '1.0.0' } },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), removeItem: vi.fn() },
}));
vi.mock('react-native-mmkv', () => ({ MMKV: vi.fn() }));
vi.mock('@/lib/storage-key', () => ({
  getOrCreateMmkvEncryptionKey: vi.fn().mockResolvedValue('test-key'),
}));
vi.mock('@tanstack/query-sync-storage-persister', () => ({
  createSyncStoragePersister: vi.fn().mockReturnValue({
    persistClient: vi.fn(),
    restoreClient: vi.fn(),
    removeClient: vi.fn(),
  }),
}));

import { EVICTION_QUERY_AGE_MS, pruneStaleUnobservedQueries } from '@/lib/query-persister';

describe('pruneStaleUnobservedQueries (H8)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    queryClient.clear();
  });

  function seedQuery(key: readonly unknown[], dataUpdatedAt: number) {
    // setQueryData synchronously creates the query and sets dataUpdatedAt.
    // We then patch the state to a custom timestamp via the cache directly,
    // since setQueryData uses Date.now() internally.
    queryClient.setQueryData(key, { value: 'seeded' });
    const q = queryClient.getQueryCache().find({ queryKey: key });
    if (!q) throw new Error('seed: query not found');
    // Mutate the state.dataUpdatedAt via the internal setData path.
    q.setState({ ...q.state, dataUpdatedAt });
  }

  it('evicts queries older than the age threshold with no observers', () => {
    const now = Date.now();
    seedQuery(['old-1'], now - EVICTION_QUERY_AGE_MS - 1_000);
    seedQuery(['fresh-1'], now - 60_000);

    const { evicted } = pruneStaleUnobservedQueries(queryClient);

    expect(evicted).toBe(1);
    expect(queryClient.getQueryCache().find({ queryKey: ['old-1'] })).toBeUndefined();
    expect(queryClient.getQueryCache().find({ queryKey: ['fresh-1'] })).toBeDefined();
  });

  it('does not evict an aged query while it has live observers (mounted hook)', () => {
    const now = Date.now();
    seedQuery(['old-but-watched'], now - EVICTION_QUERY_AGE_MS - 60_000);

    // Subscribe an observer so getObserversCount() > 0 (matches a mounted
    // useQuery in a screen).
    const q = queryClient.getQueryCache().find({ queryKey: ['old-but-watched'] });
    if (!q) throw new Error('seed: query not found');
    const observer = q as unknown as { addObserver: (o: unknown) => void };
    const dummy = {
      shouldFetchOnReconnect: false,
      shouldFetchOnWindowFocus: false,
      onQueryUpdate: () => {},
    };
    observer.addObserver(dummy);

    const { evicted } = pruneStaleUnobservedQueries(queryClient);

    expect(evicted).toBe(0);
    expect(queryClient.getQueryCache().find({ queryKey: ['old-but-watched'] })).toBeDefined();
  });

  it('is a no-op when no queries are aged', () => {
    const now = Date.now();
    seedQuery(['fresh-1'], now - 60_000);
    seedQuery(['fresh-2'], now - 30_000);

    const { evicted } = pruneStaleUnobservedQueries(queryClient);
    expect(evicted).toBe(0);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(2);
  });

  it('counts the evicted total correctly when several queries are aged', () => {
    const now = Date.now();
    // Each `old-i` is `(i+1) * 1_000ms` past the cutoff so the strict-less-than
    // filter `dataUpdatedAt < cutoff` matches all of them. Starting at exactly
    // the cutoff would NOT match (the cutoff is the exclusive boundary).
    for (let i = 0; i < 5; i++) {
      seedQuery([`old-${i}`], now - EVICTION_QUERY_AGE_MS - (i + 1) * 1_000);
    }
    seedQuery(['fresh'], now - 60_000);

    const { evicted } = pruneStaleUnobservedQueries(queryClient);
    expect(evicted).toBe(5);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1);
  });
});
