import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/**
 * Wire NetInfo to React Query's onlineManager so that:
 * - Offline mutations are queued automatically
 * - Stale queries refetch on reconnect
 */
export function setupOnlineManager() {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state: NetInfoState) => {
      setOnline(!!state.isConnected);
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
    // Get initial state immediately
    NetInfo.fetch().then((state) => {
      setIsOnline(!!state.isConnected);
    });

    // Listen for changes
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(!!state.isConnected);
    });

    return unsubscribe;
  }, []);

  return { isOnline };
}
