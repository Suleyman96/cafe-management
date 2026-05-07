import { create } from 'zustand';

export type RealtimeChannelStatus = 'connected' | 'reconnecting' | 'degraded';

interface RealtimeStatusStore {
  /** Map of channelName → current status. */
  channels: Record<string, RealtimeChannelStatus>;
  setChannelStatus: (channelName: string, status: RealtimeChannelStatus) => void;
  removeChannel: (channelName: string) => void;
  /** True when ANY tracked channel is in the `degraded` state. */
  isAnyDegraded: () => boolean;
  /** True when ANY tracked channel is not `connected` (degraded or reconnecting). */
  isAnyUnhealthy: () => boolean;
}

/**
 * Tracks the live state of every Supabase realtime channel managed by
 * `useRealtimeSync` so the UI can surface degraded connections (e.g. after the
 * channel exhausts its retry budget). Without this, the kitchen has no signal
 * that the 2-min fallback poll is the only thing keeping data fresh — and
 * loses audible new-order alerts because real INSERT events stop arriving.
 */
export const useRealtimeStatusStore = create<RealtimeStatusStore>((set, get) => ({
  channels: {},
  setChannelStatus: (channelName, status) =>
    set((s) => ({ channels: { ...s.channels, [channelName]: status } })),
  removeChannel: (channelName) =>
    set((s) => {
      const { [channelName]: _omit, ...rest } = s.channels;
      return { channels: rest };
    }),
  isAnyDegraded: () => Object.values(get().channels).some((st) => st === 'degraded'),
  isAnyUnhealthy: () => Object.values(get().channels).some((st) => st !== 'connected'),
}));
