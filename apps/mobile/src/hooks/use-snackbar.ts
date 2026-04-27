import { isAppError } from '@gustri/core';
import { useCallback, useContext } from 'react';
import { SnackbarContext } from '@/components/providers/SnackbarProvider';

/**
 * Resolve an error input (string or Error) into a user-facing message.
 *
 * Typed AppError subclasses keep their semantic message; ValidationError details
 * are surfaced as a flat hint when present (full per-field feedback is opt-in
 * by reading `error.details` directly at the call site).
 */
function resolveMessage(input: string | Error, fallback: string): string {
  if (typeof input === 'string') return input;

  if (isAppError(input)) {
    const details = input.details as
      | { fieldErrors?: Record<string, string[]>; formErrors?: string[] }
      | undefined;
    if (input.code === 'VALIDATION_ERROR' && details) {
      const firstField = Object.entries(details.fieldErrors ?? {}).find(
        ([, msgs]) => msgs && msgs.length > 0,
      );
      if (firstField) {
        const [field, msgs] = firstField;
        return `${field}: ${msgs[0]}`;
      }
      const formErr = details.formErrors?.[0];
      if (formErr) return formErr;
    }
    return input.message;
  }

  if (input instanceof Error && input.message) return input.message;
  return fallback;
}

export function useSnackbar() {
  const { showSnackbar } = useContext(SnackbarContext);

  const showSuccess = useCallback(
    (message: string) => showSnackbar(message, 'success'),
    [showSnackbar],
  );

  const showError = useCallback(
    (input: string | Error, fallback = 'An unexpected error occurred') => {
      showSnackbar(resolveMessage(input, fallback), 'error');
    },
    [showSnackbar],
  );

  const showInfo = useCallback((message: string) => showSnackbar(message, 'info'), [showSnackbar]);

  return { showSuccess, showError, showInfo };
}
