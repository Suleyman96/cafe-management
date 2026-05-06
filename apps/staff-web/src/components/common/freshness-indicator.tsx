'use client';

import { useTranslation } from '@gustri/i18n';
import { Wifi, WifiOff } from 'lucide-react';
import { type RefObject, useEffect, useState } from 'react';

/**
 * Plan 12 — "Last updated" indicator for the kitchen and orders views.
 *
 * Shows how long it has been since the most recent realtime event was
 * received on the page's channel. Color band:
 *   - green   < 30s  (matches normal foreground fallback cadence)
 *   - amber  30s–120s (degraded — fallback poll territory)
 *   - red    > 120s   (stale — almost certainly disconnected)
 *
 * The thresholds align with `FOREGROUND_FALLBACK_MS` (30s) and the
 * disconnected banner heuristic (120s) inside `useRealtimeSync` /
 * `connection-provider`, so a red badge here usually shows up alongside
 * the "Connection lost" banner rather than contradicting it.
 *
 * The component takes the `lastEventAtRef` returned by `useRealtimeSync`
 * (a stable React ref) and re-renders itself once per second via a local
 * tick. Reading from the ref means the parent page never has to subscribe
 * to per-event re-renders just to refresh a badge.
 */

const AMBER_THRESHOLD_MS = 30_000;
const RED_THRESHOLD_MS = 120_000;
const TICK_INTERVAL_MS = 1_000;

type Props = {
  lastEventAtRef: RefObject<number | null>;
  className?: string;
};

export function FreshnessIndicator({ lastEventAtRef, className }: Props) {
  const { t } = useTranslation('staff');
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const lastEventAt = lastEventAtRef.current;
  if (lastEventAt === null) {
    // Channel hasn't received anything yet (still subscribing or low-volume
    // tenant pre-stamp). Show a neutral "connecting" state rather than a
    // misleading red.
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 ${className ?? ''}`}
        aria-live="polite"
      >
        <WifiOff className="h-3.5 w-3.5" aria-hidden />
        {t('freshness.connecting')}
      </span>
    );
  }

  const elapsedMs = Math.max(0, now - lastEventAt);
  const elapsedSec = Math.floor(elapsedMs / 1000);

  let label: string;
  if (elapsedSec < 5) {
    label = t('freshness.justNow');
  } else if (elapsedSec < 60) {
    label = t('freshness.secondsAgo', { count: elapsedSec });
  } else {
    const minutes = Math.floor(elapsedSec / 60);
    label = t('freshness.minutesAgo', { count: minutes });
  }

  let tone: string;
  let Icon = Wifi;
  if (elapsedMs >= RED_THRESHOLD_MS) {
    tone = 'text-red-600';
    Icon = WifiOff;
  } else if (elapsedMs >= AMBER_THRESHOLD_MS) {
    tone = 'text-amber-600';
  } else {
    tone = 'text-green-600';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${tone} ${className ?? ''}`}
      aria-live="polite"
      title={elapsedMs >= RED_THRESHOLD_MS ? t('freshness.stale') : undefined}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {t('freshness.updated', { time: label })}
    </span>
  );
}
