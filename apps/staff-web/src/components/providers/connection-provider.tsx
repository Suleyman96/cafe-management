'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

type ConnectionStatus = 'connected' | 'degraded' | 'disconnected';

const ConnectionContext = createContext<ConnectionStatus>('connected');

export function useConnectionStatus() {
  return useContext(ConnectionContext);
}

const DEGRADED_THRESHOLD = 3;
const DISCONNECTED_THRESHOLD = 6;
const DECAY_ON_SUCCESS = 2;

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
