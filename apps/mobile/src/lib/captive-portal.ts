import { create } from 'zustand';

/**
 * Captive-portal state. NetInfo's `isConnected: true` is necessary but not
 * sufficient: hotel/cafe Wi-Fi commonly hands out a DHCP lease, advertises
 * full link-layer connectivity, but blocks all traffic until the user opens
 * a browser-based login. The reachability HEAD probe in `use-network-status`
 * flips this flag when a connected network can't reach the API.
 *
 * The OfflineBanner uses this flag to differentiate copy: a captive-portal
 * "no internet" message tells the waiter to authenticate the network,
 * versus a generic offline banner that suggests waiting for signal.
 */
interface CaptivePortalState {
  captivePortal: boolean;
  setCaptivePortal: (value: boolean) => void;
}

export const useCaptivePortalStore = create<CaptivePortalState>((set) => ({
  captivePortal: false,
  setCaptivePortal: (captivePortal) => set({ captivePortal }),
}));

/**
 * Simple result cache for the HEAD probe, keyed by network identity. Hotels
 * generally hand out the same gateway IP/SSID for the duration of the stay;
 * caching avoids hammering the probe endpoint when NetInfo emits a flurry
 * of `isConnected: true` events on initial connect.
 */
const REACHABILITY_CACHE_TTL_MS = 30_000;
type CacheEntry = { reachable: boolean; storedAt: number };
const cache = new Map<string, CacheEntry>();

export function readCachedReachability(networkId: string): boolean | null {
  const entry = cache.get(networkId);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > REACHABILITY_CACHE_TTL_MS) {
    cache.delete(networkId);
    return null;
  }
  return entry.reachable;
}

export function writeCachedReachability(networkId: string, reachable: boolean): void {
  cache.set(networkId, { reachable, storedAt: Date.now() });
}

export function __resetCaptivePortalForTests(): void {
  cache.clear();
  useCaptivePortalStore.setState({ captivePortal: false });
}
