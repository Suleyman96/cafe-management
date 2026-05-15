import { QUERY_KEYS, tenantKey } from '@gustri/queries';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  useDeleteTable,
  useTable,
  useTableByQrCode,
  useTables,
  useUpdateTable,
  useUpdateTableStatus,
} from '@/hooks/use-tables-safe';
import { withOptimisticTtl } from '@/lib/optimistic-ttl';
import { db } from '@/lib/supabase/wrapped-client';
import {
  createWrapper,
  renderHookWithProviders,
  TEST_TENANT_ID,
  waitFor,
} from '../helpers/test-utils';

// See use-orders-safe.test.tsx for the rationale on this module-wide mock.
vi.mock('@/lib/optimistic-ttl', () => ({
  withOptimisticTtl: vi.fn(() => () => {}),
}));
const mockedWithOptimisticTtl = vi.mocked(withOptimisticTtl);

// --- Hooks from @gustri/queries (use useDb → mockDb from provider) ---

describe('useTables', () => {
  it('calls db.tables.findAll', () => {
    const { mockDb } = renderHookWithProviders(() => useTables());
    expect(mockDb.tables.findAll).toHaveBeenCalled();
  });

  it('returns fetched tables data', async () => {
    const mockTables = [{ id: 't1', table_number: 'T01', status: 'free' }];
    const { wrapper, mockDb } = createWrapper();
    (mockDb.tables.findAll as any).mockResolvedValueOnce(mockTables);
    const { result } = renderHook(() => useTables(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(mockTables));
  });

  it('reports error when findAll rejects', async () => {
    const { wrapper, mockDb } = createWrapper();
    (mockDb.tables.findAll as any).mockRejectedValueOnce(new Error('DB error'));
    const { result } = renderHook(() => useTables(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useTable', () => {
  it('calls findById with id', () => {
    const { mockDb } = renderHookWithProviders(() => useTable('t1'));
    expect(mockDb.tables.findById).toHaveBeenCalledWith('t1');
  });

  it('is disabled when id is empty', () => {
    const { mockDb } = renderHookWithProviders(() => useTable(''));
    expect(mockDb.tables.findById).not.toHaveBeenCalled();
  });
});

describe('useTableByQrCode', () => {
  it('calls findByQrCode', () => {
    const { mockDb } = renderHookWithProviders(() => useTableByQrCode('qr-abc'));
    expect(mockDb.tables.findByQrCode).toHaveBeenCalledWith('qr-abc');
  });

  it('is disabled when qrCode is empty', () => {
    const { mockDb } = renderHookWithProviders(() => useTableByQrCode(''));
    expect(mockDb.tables.findByQrCode).not.toHaveBeenCalled();
  });

  it('useTableByQrCode calls findByQrCode', () => {
    const { mockDb } = renderHookWithProviders(() => useTableByQrCode('abc123'));
    expect(mockDb.tables.findByQrCode).toHaveBeenCalledWith('abc123');
  });
});

// --- Local hooks (use direct db import → assert on db from vi.mock) ---

describe('useUpdateTableStatus', () => {
  it('invalidates TABLES and ORDERS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateTableStatus());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ tableId: 't1', status: 'occupied' as any });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));
  });

  it('calls updateStatus with correct args', async () => {
    const { result } = renderHookWithProviders(() => useUpdateTableStatus());
    await result.current.mutateAsync({ tableId: 't1', status: 'occupied' as any });
    expect(db.tables.updateStatus).toHaveBeenCalledWith('t1', 'occupied');
  });

  // --- Optimistic TTL wiring (Plan 7) ---
  it('schedules a TTL revert in onMutate against TABLES and ORDERS', async () => {
    const cancel = vi.fn();
    mockedWithOptimisticTtl.mockReturnValue(cancel);

    const { result } = renderHookWithProviders(() => useUpdateTableStatus());
    await result.current.mutateAsync({ tableId: 't1', status: 'occupied' as any });

    expect(mockedWithOptimisticTtl).toHaveBeenCalledWith(expect.anything(), [
      tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES),
      tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS),
    ]);
  });

  it('cancels the TTL on successful settle', async () => {
    const cancel = vi.fn();
    mockedWithOptimisticTtl.mockReturnValue(cancel);

    const { result } = renderHookWithProviders(() => useUpdateTableStatus());
    await result.current.mutateAsync({ tableId: 't1', status: 'occupied' as any });

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('cancels the TTL when the mutation rejects', async () => {
    const cancel = vi.fn();
    mockedWithOptimisticTtl.mockReturnValue(cancel);
    (db.tables.updateStatus as any).mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHookWithProviders(() => useUpdateTableStatus());
    await result.current.mutateAsync({ tableId: 't1', status: 'occupied' as any }).catch(() => {});

    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

// Note: `useCreateTable` is re-exported verbatim from @gustri/queries.
// Its behavior is covered by packages/queries/src/__tests__/mutations/
// use-table-mutations.test.ts. The local soft pre-check (which used to
// live here) was deleted — the table cap is now enforced exclusively
// by the `enforce_table_cap_trigger` server-side, which raises the
// `plan_required` sentinel that mutation cache `onError` localizes.

// --- Mutations from @gustri/queries (use useDb → mockDb from provider) ---

describe('useUpdateTable', () => {
  it('invalidates TABLES on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateTable());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 't1', updates: { capacity: 6 } as any });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
  });
});

describe('useDeleteTable', () => {
  it('invalidates TABLES on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteTable());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('t1');

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
  });

  it('invalidates TABLES on delete', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteTable());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync('t1');
    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TABLES));
  });
});
