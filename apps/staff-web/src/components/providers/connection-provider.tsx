'use client';

import { useTranslation } from '@gustri/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

type ConnectionStatus = 'connected' | 'degraded' | 'disconnected';

const ConnectionContext = createContext<ConnectionStatus>('connected');

export function useConnectionStatus() {
  return useContext(ConnectionContext);
}

const DEGRADED_THRESHOLD = 3;
const DISCONNECTED_THRESHOLD = 6;
const DECAY_ON_SUCCESS = 2;

// Health-poll cadence. 5 min strikes a balance between catching deploys
// quickly and not flooding the route with hits from 50 tablets. The poll
// is also opportunistically driven by `online` events so a tab that wakes
// from sleep checks immediately rather than waiting up to 5 min.
const HEALTH_POLL_INTERVAL_MS = 5 * 60 * 1000;

// Single in-flight toast — re-rendering / re-checking shouldn't stack
// toasts. Lives at module scope so React Strict Mode's double-mount
// doesn't double-fire either.
let versionMismatchToastId: string | number | null = null;

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('connected');
  const failureCount = useRef(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (!event || event.type !== 'updated') return;

      const queryState = event.query.state;

      if (queryState.status === 'error') {
        failureCount.current++;
        if (failureCount.current >= DISCONNECTED_THRESHOLD) {
          setStatus('disconnected');
        } else if (failureCount.current >= DEGRADED_THRESHOLD) {
          setStatus('degraded');
        }
      }

      if (queryState.status === 'success') {
        failureCount.current = Math.max(0, failureCount.current - DECAY_ON_SUCCESS);
        if (failureCount.current < DEGRADED_THRESHOLD) {
          setStatus('connected');
        }
      }
    });

    return () => unsubscribe();
  }, [queryClient]);

  return (
    <ConnectionContext.Provider value={status}>
      {status !== 'connected' && <ConnectionBanner status={status} />}
      <VersionSkewWatcher />
      {children}
    </ConnectionContext.Provider>
  );
}

function ConnectionBanner({ status }: { status: 'degraded' | 'disconnected' }) {
  const isDegraded = status === 'degraded';

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[60] px-4 py-2 text-center text-sm font-medium ${
        isDegraded
          ? 'bg-amber-50 text-amber-800 border-b border-amber-200'
          : 'bg-red-50 text-red-800 border-b border-red-200'
      }`}
    >
      {isDegraded
        ? 'Some features may be slow. Retrying...'
        : 'Connection lost. Changes may not be saved.'}
    </div>
  );
}

/**
 * Polls /api/v1/health and surfaces a "new version available" toast when
 * the server's build SHA stops matching the SHA that was burned into our
 * bundle at build time (Blocker 7).
 *
 * The point isn't to detect server health — that's the connection
 * banner's job. The point is to catch the case where the user has the
 * tab open across a deploy: their cached JS is now N commits behind
 * production, and any client_request_id schema or RPC name change will
 * 400 against the new server. A nudge to reload converts a confusing
 * silent failure into a one-tap fix.
 *
 * Skipped when:
 *   - NEXT_PUBLIC_BUILD_SHA is unset or 'dev' — no meaningful comparison
 *     to make in local dev (every reload would otherwise trigger).
 *   - The fetch fails — that's the connection banner's territory.
 *   - Server returns sha='unknown' (env not wired on the server side).
 */
function VersionSkewWatcher() {
  const { t } = useTranslation('staff');

  useEffect(() => {
    const localSha = process.env.NEXT_PUBLIC_BUILD_SHA;
    if (!localSha || localSha === 'dev') return;

    let cancelled = false;

    async function check() {
      try {
        const res = await fetch('/api/v1/health', { cache: 'no-store' });
        if (cancelled) return;
        // 503 still carries `sha` in its body; only skip on parse failure.
        const body = (await res.json()) as { sha?: string } | null;
        const remoteSha = body?.sha;
        if (!remoteSha || remoteSha === 'unknown') return;
        if (remoteSha === localSha) return;

        if (versionMismatchToastId !== null) return;
        versionMismatchToastId = toast.message(t('updateAvailable.title'), {
          description: t('updateAvailable.description'),
          duration: Infinity,
          action: {
            label: t('updateAvailable.refresh'),
            onClick: () => window.location.reload(),
          },
        });
      } catch {
        // Network/parse errors are the connection banner's job; ignore here.
      }
    }

    check();
    const interval = setInterval(check, HEALTH_POLL_INTERVAL_MS);
    const onOnline = () => check();
    window.addEventListener('online', onOnline);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('online', onOnline);
    };
  }, [t]);

  return null;
}
