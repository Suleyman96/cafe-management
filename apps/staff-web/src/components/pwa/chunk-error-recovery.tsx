'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/**
 * Reactive recovery for stale chunk URLs after a deploy.
 *
 * The proactive path (`VersionSkewWatcher` in `connection-provider.tsx`)
 * polls `/api/v1/health` every 5 min and nudges the user to reload when
 * the server's build SHA stops matching the bundle's SHA. The gap that
 * watcher can't close: the user navigates DURING the window between a
 * deploy landing and the next poll. Their cached chunk URLs point at
 * `_next/static/chunks/<old-sha>/...` which now 404 on the CDN, and the
 * route silently fails to mount — exactly the "page never loads, had to
 * refresh from home" symptom users report.
 *
 * Strategy: catch the chunk-load failure via `error` /
 * `unhandledrejection` and force `window.location.reload()` once per
 * tab. The session-storage guard prevents reload loops: if the very next
 * load also chunk-fails (e.g. the deploy itself is broken), we stop
 * reloading and let the user / `VersionSkewWatcher`'s hard-block overlay
 * handle it.
 *
 * The guard clears 10s after a successful mount — if we're still
 * standing after 10s we're stable, and a future deploy can recover
 * again. (sessionStorage is the right scope: each tab tracks its own
 * recovery state.)
 */

const RELOAD_FLAG_KEY = 'gustri:chunk-reload';
const STABLE_AFTER_MS = 10_000;

export function isChunkLoadError(input: unknown): boolean {
  if (input instanceof Error && input.name === 'ChunkLoadError') return true;
  const message =
    typeof input === 'string'
      ? input
      : input instanceof Error
        ? input.message
        : input && typeof input === 'object' && 'message' in input
          ? String((input as { message: unknown }).message ?? '')
          : '';
  if (!message) return false;
  // Chunk names can include hyphens (`app-pages-internals`,
  // `framework-x`), so allow the full word-char + hyphen set.
  return (
    /ChunkLoadError/.test(message) ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Loading CSS chunk [\w-]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message)
  );
}

export function ChunkErrorRecovery() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let stableTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      try {
        sessionStorage.removeItem(RELOAD_FLAG_KEY);
      } catch {
        // sessionStorage can throw in private-mode Safari; the guard is
        // best-effort.
      }
      stableTimer = null;
    }, STABLE_AFTER_MS);

    function maybeReload(culprit: unknown) {
      if (!isChunkLoadError(culprit)) return;

      let alreadyReloaded = false;
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG_KEY) !== null;
      } catch {
        // sessionStorage blocked — fall through and reload anyway. The
        // worst case is a single extra reload, which is still better
        // than a hung page.
      }

      if (alreadyReloaded) {
        // Already tried once this tab. The deploy itself is likely
        // broken, or the user is offline. Surface to Sentry and let the
        // VersionSkewWatcher's hard-block overlay (or the user)
        // recover; don't loop.
        Sentry.captureMessage('Chunk load failed after recovery reload', {
          level: 'error',
          extra: { url: window.location.href },
        });
        return;
      }

      try {
        sessionStorage.setItem(RELOAD_FLAG_KEY, String(Date.now()));
      } catch {
        // see above
      }
      Sentry.captureMessage('Chunk load error — forcing reload', {
        level: 'warning',
        extra: { url: window.location.href },
      });
      window.location.reload();
    }

    const onError = (e: ErrorEvent) => {
      // Prefer the actual Error object when present — its `.name` is the
      // most reliable signal. Fall back to the message string for cases
      // where the runtime doesn't preserve the original Error.
      maybeReload(e.error ?? e.message);
    };
    const onUnhandledRejection = (e: PromiseRejectionEvent) => {
      maybeReload(e.reason);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      if (stableTimer !== null) clearTimeout(stableTimer);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  return null;
}
