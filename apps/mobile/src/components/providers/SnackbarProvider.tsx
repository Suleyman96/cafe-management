import type React from 'react';
import { createContext, useCallback, useMemo, useState } from 'react';
import { Snackbar } from 'react-native-paper';

type SnackbarType = 'success' | 'error' | 'info';

interface SnackbarContextValue {
  showSnackbar: (message: string, type?: SnackbarType) => void;
}

export const SnackbarContext = createContext<SnackbarContextValue>({
  showSnackbar: () => {},
});

const TYPE_COLORS: Record<SnackbarType, string> = {
  success: '#10b981',
  error: '#ef4444',
  info: '#367B8B',
};

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<SnackbarType>('info');

  const showSnackbar = useCallback((msg: string, t: SnackbarType = 'info') => {
    setMessage(msg);
    setType(t);
    setVisible(true);
  }, []);

  const value = useMemo(() => ({ showSnackbar }), [showSnackbar]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <Snackbar
        visible={visible}
        onDismiss={() => setVisible(false)}
        duration={3000}
        style={{ backgroundColor: TYPE_COLORS[type] }}
        action={{ label: 'OK', onPress: () => setVisible(false), textColor: '#fff' }}
      >
        {message}
      </Snackbar>
    </SnackbarContext.Provider>
  );
}
