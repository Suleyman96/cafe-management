import { describe, expect, it, vi } from 'vitest';
import { QUERY_KEYS } from '../../keys';
import {
  useCreateStaff,
  useDeleteStaff,
  useUpdateStaff,
} from '../../mutations/use-staff-mutations';
import { renderHookWithProviders } from '../helpers/test-utils';

function getInvalidatedKeys(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.map((c: any) => (c[0] as any).queryKey);
}

describe('useCreateStaff', () => {
  it('calls db.staff.create with data', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useCreateStaff());
    const data = { email: 'x@y.com', role: 'waiter' } as any;
    await result.current.mutateAsync(data);
    expect(mockDb.staff.create).toHaveBeenCalledWith(data);
  });

  it('invalidates staff on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateStaff());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({} as any);
    expect(getInvalidatedKeys(spy)).toContainEqual([QUERY_KEYS.STAFF]);
  });

  it('propagates errors', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useCreateStaff());
    (mockDb.staff.create as any).mockRejectedValueOnce(new Error('dup'));
    await expect(result.current.mutateAsync({} as any)).rejects.toThrow('dup');
  });
});

describe('useUpdateStaff', () => {
  it('calls db.staff.update with id + updates', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateStaff());
    await result.current.mutateAsync({ id: 's1', updates: { role: 'admin' } as any });
    expect(mockDb.staff.update).toHaveBeenCalledWith('s1', { role: 'admin' });
  });

  it('invalidates staff on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateStaff());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({ id: 's1', updates: {} as any });
    expect(getInvalidatedKeys(spy)).toContainEqual([QUERY_KEYS.STAFF]);
  });
});

describe('useDeleteStaff', () => {
  it('calls db.staff.delete with id', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useDeleteStaff());
    await result.current.mutateAsync('s1');
    expect(mockDb.staff.delete).toHaveBeenCalledWith('s1');
  });

  it('invalidates staff on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteStaff());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync('s1');
    expect(getInvalidatedKeys(spy)).toContainEqual([QUERY_KEYS.STAFF]);
  });
});
