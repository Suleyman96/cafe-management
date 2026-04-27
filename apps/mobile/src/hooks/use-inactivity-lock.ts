import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { forceLogout } from '@/lib/auth';
import { useAuthStore } from '@/store/auth-store';

/** Auto-logout after 15 minutes in background to protect shared devices. */
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

export function useInactivityLock() {
  const backgroundedAt = useRef<number | null>(null);
  const staff = useAuthStore((s) => s.staff);

  useEffect(() => {
    if (!staff) return;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundedAt.current = Date.now();
      } else if (nextState === 'active' && backgroundedAt.current) {
        const elapsed = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (elapsed >= INACTIVITY_TIMEOUT_MS) {
          // forceLogout owns ordering and never throws — the previous code
          // ran logout() and clearAuth() separately, which left local state
          // in a torn state if logout() rejected.
          void forceLogout('inactivity');
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [staff]);
}
