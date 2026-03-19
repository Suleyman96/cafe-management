import { useCallback, useContext } from 'react';
import { SnackbarContext } from '@/components/providers/SnackbarProvider';

export function useSnackbar() {
  const { showSnackbar } = useContext(SnackbarContext);

  const showSuccess = useCallback(
    (message: string) => showSnackbar(message, 'success'),
    [showSnackbar],
  );

  const showError = useCallback(
    (message: string) => showSnackbar(message, 'error'),
    [showSnackbar],
  );

  const showInfo = useCallback((message: string) => showSnackbar(message, 'info'), [showSnackbar]);

  return { showSuccess, showError, showInfo };
}
