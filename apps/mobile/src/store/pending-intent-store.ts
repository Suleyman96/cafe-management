import { create } from 'zustand';

export type NotificationData = Record<string, unknown> | null | undefined;

export type PendingIntent =
  | { type: 'notification'; data: NotificationData }
  | { type: 'deep-link'; url: string };

interface PendingIntentState {
  pending: PendingIntent | null;
  setPending: (intent: PendingIntent) => void;
  consumePending: () => PendingIntent | null;
}

export const usePendingIntentStore = create<PendingIntentState>((set, get) => ({
  pending: null,
  setPending: (pending) => set({ pending }),
  consumePending: () => {
    const current = get().pending;
    if (current) set({ pending: null });
    return current;
  },
}));
