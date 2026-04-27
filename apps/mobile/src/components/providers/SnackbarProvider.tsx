import type React from 'react';
import { createContext, useCallback, useMemo, useState } from 'react';
import { Snackbar } from 'react-native-paper';
import { BRAND_PRIMARY } from '@/theme';

type SnackbarType = 'success' | 'error' | 'info';

interface SnackbarContextValue {
  showSnackbar: (message: string, type?: SnackbarType) => void;
}

export const SnackbarContext = createContext<SnackbarContextValue>({
  showSnackbar: () => {},
});

/** Imperative snackbar access for use outside React tree (e.g. MutationCache.onError). */
const globalSnackbarRef: { current: ((message: string, type?: SnackbarType) => void) | null } = {
  current: null,
};

export function showSnackbarGlobal(message: string, type: SnackbarType = 'error') {
  globalSnackbarRef.current?.(message, type);
}

const TYPE_COLORS: Record<SnackbarType, string> = {
  success: '#10b981',
  error: '#ef4444',
  info: BRAND_PRIMARY,
};

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Array<{ message: string; type: SnackbarType }>>([]);
  const current = queue[0];

  const showSnackbar = useCallback((msg: string, t: SnackbarType = 'info') => {
    setQueue((prev) => [...prev, { message: msg, type: t }]);
  }, []);

  // Register for imperative access outside React tree
  globalSnackbarRef.current = showSnackbar;

  const handleDismiss = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  const value = useMemo(() => ({ showSnackbar }), [showSnackbar]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <Snackbar
        visible={!!current}
        onDismiss={handleDismiss}
        duration={3000}
        style={{ backgroundColor: current ? TYPE_COLORS[current.type] : TYPE_COLORS.info }}
        action={{ label: 'OK', onPress: handleDismiss, textColor: '#fff' }}
      >
        {current?.message ?? ''}
      </Snackbar>
    </SnackbarContext.Provider>
  );
}
