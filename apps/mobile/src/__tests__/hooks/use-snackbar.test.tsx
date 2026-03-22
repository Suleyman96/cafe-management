import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

// vi.hoisted runs before vi.mock hoisting, so the context is available in the mock factory
const { MockSnackbarContext } = vi.hoisted(() => {
  const { createContext } = require('react');
  return {
    MockSnackbarContext: createContext<{
      showSnackbar: (message: string, type?: string) => void;
    }>({
      showSnackbar: () => {},
    }),
  };
});

vi.mock('@/components/providers/SnackbarProvider', () => ({
  SnackbarContext: MockSnackbarContext,
}));

import { useSnackbar } from '@/hooks/use-snackbar';

function createSnackbarWrapper() {
  const calls: { message: string; type?: string }[] = [];

  const showSnackbar = (message: string, type?: string) => {
    calls.push({ message, type });
  };

  const wrapper = ({ children }: { children: ReactNode }) => (
    <MockSnackbarContext.Provider value={{ showSnackbar }}>{children}</MockSnackbarContext.Provider>
  );

  return { wrapper, calls };
}

describe('useSnackbar', () => {
  it('showSuccess calls showSnackbar with success type', () => {
    const { wrapper, calls } = createSnackbarWrapper();
    const { result } = renderHook(() => useSnackbar(), { wrapper });

    result.current.showSuccess('Done!');

    expect(calls).toContainEqual({ message: 'Done!', type: 'success' });
  });

  it('showError calls showSnackbar with error type', () => {
    const { wrapper, calls } = createSnackbarWrapper();
    const { result } = renderHook(() => useSnackbar(), { wrapper });

    result.current.showError('Failed!');

    expect(calls).toContainEqual({ message: 'Failed!', type: 'error' });
  });

  it('showInfo calls showSnackbar with info type', () => {
    const { wrapper, calls } = createSnackbarWrapper();
    const { result } = renderHook(() => useSnackbar(), { wrapper });

    result.current.showInfo('Info message');

    expect(calls).toContainEqual({ message: 'Info message', type: 'info' });
  });
});
