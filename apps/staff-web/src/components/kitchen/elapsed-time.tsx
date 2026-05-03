'use client';

import { useEffect, useState } from 'react';

/**
 * Self-ticking elapsed-minutes display for the kitchen view.
 *
 * Pre-fix the kitchen page held a `useReducer` + `setInterval(60_000)` that
 * forced a full-tree rerender every minute solely to refresh elapsed times,
 * costing ~16ms × 30 cards on a busy shift. This leaf owns its own tick so
 * only the number node re-renders; the order-card tree stays stable until
 * a realtime/data event drives a refetch.
 *
 * Trade-off: threshold-driven styling on the parent (card border, URGENT
 * badge) is computed from `created_at` at render time and stays frozen
 * until the next data event. Acceptable for kitchen workflow — items
 * change frequently enough that color updates land within a tick or two.
 */
export function ElapsedTime({ since }: { since: string | Date }) {
  const sinceMs = typeof since === 'string' ? new Date(since).getTime() : since.getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const minutes = Math.max(0, Math.floor((now - sinceMs) / 60_000));
  return <>{minutes}</>;
}
