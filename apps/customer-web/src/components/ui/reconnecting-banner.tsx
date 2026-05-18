'use client';

import { useTranslation } from '@gustri/i18n';
import { Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { RealtimeStatus } from '@/hooks/use-order';

interface ReconnectingBannerProps {
  /** Current realtime channel status reported by the hook. */
  rtStatus: RealtimeStatus;
  /** `Date.now()`-style ms timestamp of the last successful query update. */
  dataUpdatedAt: number;
  /** Tear down the channel + refetch the query. */
  onRefresh: () => void;
  /** Staleness threshold in ms before the banner is allowed to show. */
  staleThresholdMs?: number;
}

/**
 * H1 — surface websocket disconnects so the customer doesn't stare at a
 * frozen status screen wondering whether the app or the kitchen has hung.
 *
 * Two conditions must hold before the banner appears:
 *   1. `rtStatus !== 'SUBSCRIBED'` — realtime channel is in some state
 *      other than connected (TIMED_OUT, CLOSED, CHANNEL_ERROR,
 *      CONNECTING after a re-establish, …).
 *   2. The query data is older than `staleThresholdMs` (default 30s).
 *      Gating by staleness alone is too noisy on every fresh mount
 *      where the channel briefly sits in CONNECTING; gating by
 *      status alone surfaces banners during the normal SUBSCRIBED
 *      grace period of a recently-loaded screen.
 *
 * The `Refresh` button calls `onRefresh`, which the hook implements as
 * "tear down the live channel and refetch the query." The new subscribe
 * attempt drives `rtStatus` back toward SUBSCRIBED on success.
 */
export function ReconnectingBanner({
  rtStatus,
  dataUpdatedAt,
  onRefresh,
  staleThresholdMs = 30_000,
}: ReconnectingBannerProps) {
  const { t } = useTranslation('customer');
  // Re-evaluate the staleness condition periodically — the banner has no
  // other reason to re-render once mounted, but the threshold trips with
  // wall-clock time, not a state change. 5s is a coarse-enough tick that
  // the banner doesn't lag perceptibly behind reality.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(id);
  }, []);

  const isDisconnected = rtStatus !== 'SUBSCRIBED';
  const isStale = dataUpdatedAt > 0 && now - dataUpdatedAt > staleThresholdMs;
  if (!isDisconnected || !isStale) return null;

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-3 flex items-center gap-3">
      <Loader2 className="h-4 w-4 animate-spin text-amber-700 dark:text-amber-300 shrink-0" />
      <span className="flex-1 text-sm font-medium text-amber-900 dark:text-amber-100">
        {t('realtime.reconnecting')}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-amber-900 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-800 transition-colors"
      >
        <RefreshCw className="h-3 w-3" />
        {t('realtime.refresh')}
      </button>
    </div>
  );
}
