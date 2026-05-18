'use client';

import { useEffect, useState } from 'react';
import { getServerNow } from '@/lib/server-clock';

/**
 * Self-ticking elapsed-minutes display for the kitchen view.
 *
 * Pre-fix the kitchen page held a `useReducer` + `setInterval(60_000)` that
 * forced a full-tree rerender every minute solely to refresh elapsed times,
 * costing ~16ms × 30 cards on a busy shift. This leaf owns its own tick so
 * only the number node re-renders; the order-card tree stays stable until
 * a realtime/data event drives a refetch.
 *
 * Uses `getServerNow()` instead of `Date.now()` so a drifted device clock
 * (NTP-disabled tablet, dead RTC battery) doesn't make orders look more
 * or less urgent than they actually are. See lib/server-clock.ts.
 *
 * Trade-off: threshold-driven styling on the parent (card border, URGENT
 * badge) is computed from `created_at` at render time and stays frozen
 * until the next data event. Acceptable for kitchen workflow — items
 * change frequently enough that color updates land within a tick or two.
 */
export function ElapsedTime({ since }: { since: string | Date }) {
  const sinceMs = typeof since === 'string' ? new Date(since).getTime() : since.getTime();
  const [now, setNow] = useState(() => getServerNow());

  useEffect(() => {
    const id = setInterval(() => setNow(getServerNow()), 30_000);
    return () => clearInterval(id);
  }, []);

  const minutes = Math.max(0, Math.floor((now - sinceMs) / 60_000));
  return <>{minutes}</>;
}
