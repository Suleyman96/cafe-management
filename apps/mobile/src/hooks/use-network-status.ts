import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import {
  readCachedReachability,
  useCaptivePortalStore,
  writeCachedReachability,
} from '@/lib/captive-portal';

/**
 * Treat reachability === false as offline; treat null (probe pending) as online
 * so app boot isn't blocked. isConnected === true gates the layer-2 check.
 *
 * Without the isInternetReachable guard, a device on a router with no WAN
 * (common on restaurant WiFi behind a captive portal) reports "connected"
 * and React Query fires writes that immediately fail.
 */
function isEffectivelyOnline(state: NetInfoState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

const SUPABASE_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || '';
const PROBE_TIMEOUT_MS = 2_000;

/**
 * HEAD-probe a known-reachable Supabase endpoint to confirm WAN connectivity.
 * Returns true on any non-network response (even 4xx) — the goal is reaching
 * the host, not the response code. A captive portal typically intercepts and
 * either times out or returns a redirect to a non-Supabase host; both
 * manifest as a fetch failure or a wrong content type.
 */
async function probeReachability(): Promise<boolean> {
  if (!SUPABASE_URL) return true; // No URL configured — don't gate offline detection.

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    // Captive portals often return 200 from a sign-in page on a different
    // host. Trust the response only when it came from our origin — fetch
    // exposes that via `res.url`.
    return res.url.startsWith(SUPABASE_URL);
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function networkIdFor(state: NetInfoState): string {
  // Prefer details.ipAddress if available; fall back to type+isWifi for a
  // best-effort key. Different captive networks rarely share this composite.
  const details = state.details as { ipAddress?: string } | null | undefined;
  return `${state.type}:${details?.ipAddress ?? 'unknown'}`;
}

export function setupOnlineManager() {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener(async (state: NetInfoState) => {
      // Layer-2 disconnected — straight to offline; no probe needed.
      if (!isEffectivelyOnline(state)) {
        setOnline(false);
        return;
      }

      const id = networkIdFor(state);
      const cached = readCachedReachability(id);
      if (cached !== null) {
        setOnline(cached);
        useCaptivePortalStore.getState().setCaptivePortal(!cached);
        return;
      }

      // Optimistically flip online for snappy UX, then confirm via HEAD.
      // On probe failure we flip back to offline + captivePortal.
      setOnline(true);
      const reachable = await probeReachability();
      writeCachedReachability(id, reachable);
      setOnline(reachable);
      useCaptivePortalStore.getState().setCaptivePortal(!reachable);
    });
  });
}

/**
 * Hook to observe current network connectivity.
 * Used by UI components (OfflineBanner, PendingSyncBadge).
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const captivePortal = useCaptivePortalStore((s) => s.captivePortal);

  useEffect(() => {
    NetInfo.fetch().then((state) => {
      setIsOnline(isEffectivelyOnline(state));
    });

    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(isEffectivelyOnline(state));
    });

    return unsubscribe;
  }, []);

  return { isOnline, captivePortal };
}
