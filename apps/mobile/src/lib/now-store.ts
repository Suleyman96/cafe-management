import { useEffect } from 'react';
import { create } from 'zustand';

interface NowStore {
  now: number;
}

export const useNowStore = create<NowStore>(() => ({ now: Date.now() }));

const TICK_MS = 10_000;

let intervalId: ReturnType<typeof setInterval> | null = null;
let subscriberCount = 0;

function startTicking() {
  if (intervalId !== null) return;
  intervalId = setInterval(() => {
    useNowStore.setState({ now: Date.now() });
  }, TICK_MS);
}

function stopTicking() {
  if (intervalId === null) return;
  clearInterval(intervalId);
  intervalId = null;
}

/**
 * Subscribe to a shared 10s "now" tick. One global interval drives every
 * consumer, replacing per-component setInterval timers that produce N×60
 * re-renders/min on order-list screens.
 *
 * Why: a kitchen view with 30 active orders previously fired 30 setIntervals,
 * each calling setState once per second. The result was a render storm during
 * exactly the moment the screen needed to be smooth.
 */
export function useNow(): number {
  const now = useNowStore((s) => s.now);

  useEffect(() => {
    subscriberCount++;
    startTicking();
    return () => {
      subscriberCount--;
      if (subscriberCount === 0) stopTicking();
    };
  }, []);

  return now;
}

// Test-only escape hatch — lets tests reset module-level state between cases.
export function __resetNowStoreForTests() {
  stopTicking();
  subscriberCount = 0;
  useNowStore.setState({ now: Date.now() });
}
