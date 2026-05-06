'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Per-key pending lock for action buttons. The gate is ref-based so it
 * dedupes clicks within a single React render tick — `setState` would lag
 * behind a fast triple-tap because React hasn't committed the new state
 * yet when the second click handler reads it.
 *
 * Returns a stable `run` so callers can pass it into memoized children
 * without busting their memoization on every parent render.
 */
export function usePendingAction<TKey extends string = string>(): {
  isPending: (key: TKey) => boolean;
  run: <T>(key: TKey, fn: () => Promise<T>) => Promise<T | undefined>;
} {
  const pendingRef = useRef<Set<TKey>>(new Set());
  const [pending, setPending] = useState<ReadonlySet<TKey>>(() => new Set());

  const run = useCallback(async <T>(key: TKey, fn: () => Promise<T>): Promise<T | undefined> => {
    if (pendingRef.current.has(key)) return undefined;
    pendingRef.current.add(key);
    setPending(new Set(pendingRef.current));
    try {
      return await fn();
    } finally {
      pendingRef.current.delete(key);
      setPending(new Set(pendingRef.current));
    }
  }, []);

  const isPending = useCallback((key: TKey) => pending.has(key), [pending]);

  return { isPending, run };
}
