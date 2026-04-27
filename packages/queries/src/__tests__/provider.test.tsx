import type { SupabaseWrapper } from '@gustri/api-client';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { DbProvider, useDb } from '../provider';
import { createMockDb } from './helpers/mock-db';

describe('DbProvider', () => {
  it('throws a clear error when useDb is called outside a provider', () => {
    expect(() => renderHook(() => useDb())).toThrow(/must be used within a <DbProvider>/);
  });

  it('exposes the db instance to descendants', () => {
    const mockDb = createMockDb() as unknown as SupabaseWrapper;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DbProvider db={mockDb}>{children}</DbProvider>
    );
    const { result } = renderHook(() => useDb(), { wrapper });
    expect(result.current).toBe(mockDb);
  });
});
