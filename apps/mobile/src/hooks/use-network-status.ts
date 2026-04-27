import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

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

export function setupOnlineManager() {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state: NetInfoState) => {
      setOnline(isEffectivelyOnline(state));
    });
  });
}

/**
 * Hook to observe current network connectivity.
 * Used by UI components (OfflineBanner, PendingSyncBadge).
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    NetInfo.fetch().then((state) => {
      setIsOnline(isEffectivelyOnline(state));
    });

    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(isEffectivelyOnline(state));
    });

    return unsubscribe;
  }, []);

  return { isOnline };
}
