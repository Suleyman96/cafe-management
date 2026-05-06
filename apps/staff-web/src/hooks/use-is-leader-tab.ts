import { useEffect, useState } from 'react';
import { subscribeIsLeader } from '@/lib/realtime/leader-election';

/**
 * Returns `true` in exactly one tab among all open staff-web tabs.
 *
 * Used to gate audio alerts so that two open tabs of the same staff session
 * do not double-buzz on every realtime event. Toasts continue per-tab —
 * only audio is leader-only.
 *
 * The election is module-level (see `leader-election.ts`); the first hook
 * call starts it, subsequent calls reuse the same state. The hook does
 * NOT tear the election down on unmount, because the audio surface lives
 * for the entire session and re-running election on every remount would be
 * wasteful.
 */
export function useIsLeaderTab(): boolean {
  const [isLeader, setIsLeader] = useState(false);
  useEffect(() => {
    const unsubscribe = subscribeIsLeader(setIsLeader);
    return unsubscribe;
  }, []);
  return isLeader;
}
