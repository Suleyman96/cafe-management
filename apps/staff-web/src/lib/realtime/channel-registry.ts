/**
 * Module-level registry of active realtime channels keyed by channel name.
 *
 * Supabase Realtime channels do not re-authenticate when the JWT refreshes
 * (~55 min). Without intervention, the channel keeps the stale token, the
 * connection silently drops, and consumers (e.g. kitchen view) stop
 * receiving updates. This registry lets a single auth-state listener
 * resubscribe every active channel atomically on TOKEN_REFRESHED.
 */

type RegistryEntry = {
  resubscribe: () => void;
  teardown: () => void;
};

const entries = new Map<string, RegistryEntry>();

export const channelRegistry = {
  register(name: string, entry: RegistryEntry) {
    entries.set(name, entry);
  },
  unregister(name: string) {
    entries.delete(name);
  },
  resubscribeAll() {
    for (const entry of entries.values()) {
      entry.resubscribe();
    }
  },
  teardownAll() {
    for (const entry of entries.values()) {
      entry.teardown();
    }
    entries.clear();
  },
  size() {
    return entries.size;
  },
};
