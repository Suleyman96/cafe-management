/**
 * Integration test: ensures shared `@gustri/queries` hooks see the same
 * QueryClient instance the mobile app provides — i.e. that the Metro/vitest
 * dedup workarounds in this app actually keep `@tanstack/react-query` to a
 * single resolved copy.
 *
 * Background: the mobile app's `metro.config.js` manually dedupes
 * `@tanstack/react-query` because Metro's default resolution served two
 * copies (the workspace root and the app's node_modules), causing screens to
 * crash with "No QueryClient set, use QueryClientProvider to set one". The
 * vitest config mirrors that with an alias. Without one of these guards, the
 * shared `useOrders` from `@gustri/queries` calls `useQueryClient()` against
 * a different React Context than the test's `QueryClientProvider`, throwing
 * the same error.
 *
 * If this test fails, check that vitest.config.ts and metro.config.js still
 * pin `@tanstack/react-query` to a single resolution path.
 */

import { useOrders as useOrdersShared } from '@gustri/queries';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createWrapper } from '../helpers/test-utils';

describe('shared @gustri/queries integration', () => {
  it('useOrders mounts under a real QueryClientProvider without "No QueryClient" error', async () => {
    const { wrapper, mockDb } = createWrapper();
    (mockDb.orders.findAll as unknown as ReturnType<typeof Object>) = (() =>
      Promise.resolve([])) as unknown as typeof mockDb.orders.findAll;

    const { result } = renderHook(() => useOrdersShared({ limit: 10 }), { wrapper });

    // The historical regression manifests as a thrown error during render.
    // If the hook resolves cleanly to a query result, the dedup is working.
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.error).toBeFalsy();
  });
});
