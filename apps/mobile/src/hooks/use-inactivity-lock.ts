import { getInactivityTimeoutMs } from '@gustri/core';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { forceLogout } from '@/lib/auth';
import { clearLastActiveAt, readLastActiveAt, setLastActiveAt } from '@/lib/last-active-at';
import { useAuthStore } from '@/store/auth-store';

/**
 * Auto-logout after a per-role idle window. Persists `lastActiveAt` to an
 * encrypted MMKV instance on every backgrounding so the timer survives:
 *
 *  1. AppState `background` → `active` round-trips (covered by the in-memory
 *     ref in the prior implementation).
 *  2. OS-driven force-quits while backgrounded (the previous in-memory ref
 *     vanished, leaving the next launch authenticated indefinitely).
 *  3. Cold-start after the device sat locked for hours — App.tsx reads the
 *     timestamp before any screen mounts and force-logs out if the budget
 *     is blown.
 *
 * Per-role budgets come from `INACTIVITY_TIMEOUTS_BY_ROLE` in
 * `@gustri/core/constants`. Default to the most restrictive (kitchen, 15 min)
 * if role is missing — "unknown role" is closer to "shared tablet" than
 * "personal phone" in our threat model.
 *
 * Android caveat: screen lock alone does NOT always emit an AppState
 * `background` event — only home/recents/force-quit do. So an Android device
 * that auto-locks while the app is foreground can miss the lastActiveAt write.
 * The cold-start check still catches it on relaunch, and iOS fires `inactive`
 * on lock so it's covered there. A native broadcast listener for
 * `Intent.ACTION_SCREEN_OFF` would close the gap entirely — TODO: ship as a
 * follow-up Expo config plugin once the cold-start path proves out.
 */
export function useInactivityLock() {
  const staff = useAuthStore((s) => s.staff);

  useEffect(() => {
    if (!staff) return;

    const timeoutMs = getInactivityTimeoutMs(staff.role);

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        // Persist on every backgrounding so a force-quit doesn't lose the
        // mark. Stale value on next session (e.g. logout while backgrounded)
        // is harmless — the cleanupClientState path also clears the stamp.
        setLastActiveAt(Date.now());
      } else if (nextState === 'active') {
        const last = readLastActiveAt();
        if (last === null) return;
        const elapsed = Date.now() - last;
        // Clear on every resume so we don't double-trigger if the user
        // bounces between background and active before the next persist.
        clearLastActiveAt();
        if (elapsed >= timeoutMs) {
          // forceLogout owns ordering and never throws.
          void forceLogout('inactivity');
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [staff]);
}
