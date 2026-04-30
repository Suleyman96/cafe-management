import { create } from 'zustand';

export type NotificationData = Record<string, unknown> | null | undefined;

export type PendingIntent =
  | { type: 'notification'; data: NotificationData }
  | { type: 'deep-link'; url: string };

/**
 * Cap the queue at MAX_PENDING. Two pushes + a deep-link arriving while
 * logged out is the realistic upper bound; 10 leaves room for users who
 * relaunch after a long offline gap without unbounded growth (oldest
 * entries are evicted FIFO).
 */
const MAX_PENDING = 10;

interface PendingIntentState {
  pending: PendingIntent[];
  /** Append `intent` to the queue. Drops the oldest entry past `MAX_PENDING`. */
  addPending: (intent: PendingIntent) => void;
  /** Returns and clears the queue in arrival order. */
  consumeAll: () => PendingIntent[];
  /** @deprecated use {@link addPending} — left as a back-compat shim. */
  setPending: (intent: PendingIntent) => void;
  /** @deprecated use {@link consumeAll} — returns the OLDEST item, not the last. */
  consumePending: () => PendingIntent | null;
}

export const usePendingIntentStore = create<PendingIntentState>((set, get) => ({
  pending: [],
  addPending: (intent) => {
    set((state) => {
      const next = [...state.pending, intent];
      // Drop oldest entries past the cap. While a single notification +
      // deep-link is the typical case, a user who relaunches after a long
      // offline session could still queue many — bounding here is cheaper
      // than discovering a memory regression in prod.
      if (next.length > MAX_PENDING) {
        next.splice(0, next.length - MAX_PENDING);
      }
      return { pending: next };
    });
  },
  consumeAll: () => {
    const queue = get().pending;
    if (queue.length === 0) return [];
    set({ pending: [] });
    return queue;
  },
  setPending: (intent) => get().addPending(intent),
  consumePending: () => {
    const queue = get().pending;
    if (queue.length === 0) return null;
    const [head, ...rest] = queue;
    set({ pending: rest });
    return head;
  },
}));
