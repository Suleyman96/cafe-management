import { QUERY_KEYS } from '@gustri/queries';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  useActiveWaiters,
  useCreateStaff,
  useDeleteStaff,
  useStaff,
  useStaffByEmail,
  useStaffByRole,
  useStaffMember,
  useUpdateStaff,
} from '@/hooks/use-staff-safe';
import { createWrapper, renderHookWithProviders, waitFor } from '../helpers/test-utils';

describe('useStaff', () => {
  it('calls db.staff.findAll with no args when no role given', () => {
    const { mockDb } = renderHookWithProviders(() => useStaff());
    expect(mockDb.staff.findAll).toHaveBeenCalledWith(undefined);
  });

  it('passes role to findAll when given', () => {
    const { mockDb } = renderHookWithProviders(() => useStaff('ADMIN' as any));
    expect(mockDb.staff.findAll).toHaveBeenCalled();
  });

  it('returns fetched staff data', async () => {
    const mockStaff = [{ id: 's1', full_name: 'John', role: 'waiter', email: 'j@t.com' }];
    const { wrapper, mockDb } = createWrapper();
    (mockDb.staff.findAll as any).mockResolvedValueOnce(mockStaff);
    const { result } = renderHook(() => useStaff(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(mockStaff));
  });
});

describe('useActiveWaiters', () => {
  it('calls getActiveWaiters', () => {
    const { mockDb } = renderHookWithProviders(() => useActiveWaiters());
    expect(mockDb.staff.getActiveWaiters).toHaveBeenCalled();
  });
});

describe('useStaffMember', () => {
  it('calls findById with id', () => {
    const { mockDb } = renderHookWithProviders(() => useStaffMember('s1'));
    expect(mockDb.staff.findById).toHaveBeenCalledWith('s1');
  });

  it('is disabled when id is empty', () => {
    const { mockDb } = renderHookWithProviders(() => useStaffMember(''));
    expect(mockDb.staff.findById).not.toHaveBeenCalled();
  });
});

describe('useStaffByEmail', () => {
  it('calls findByEmail', () => {
    const { mockDb } = renderHookWithProviders(() => useStaffByEmail('test@test.com'));
    expect(mockDb.staff.findByEmail).toHaveBeenCalledWith('test@test.com');
  });

  it('is disabled when email is empty', () => {
    const { mockDb } = renderHookWithProviders(() => useStaffByEmail(''));
    expect(mockDb.staff.findByEmail).not.toHaveBeenCalled();
  });
});

describe('useStaffByRole', () => {
  it('useStaffByRole groups staff by actual roles including owners and kitchen', async () => {
    const mockStaff = [
      { id: 's1', full_name: 'W', role: 'waiter', email: 'w@t.com' },
      { id: 's2', full_name: 'A', role: 'admin', email: 'a@t.com' },
      { id: 's3', full_name: 'K', role: 'kitchen', email: 'k@t.com' },
      { id: 's4', full_name: 'O', role: 'owner', email: 'o@t.com' },
    ];
    const { wrapper, mockDb } = createWrapper();
    (mockDb.staff.findAll as any).mockResolvedValueOnce(mockStaff);
    const { result } = renderHook(() => useStaffByRole(), { wrapper });
    await waitFor(() => expect(result.current.data.waiters).toHaveLength(1));
    expect(result.current.data.admins).toHaveLength(1);
    expect(result.current.data.kitchen).toHaveLength(1);
    expect(result.current.data.owners).toHaveLength(1);
  });
});

describe('useCreateStaff', () => {
  it('invalidates STAFF on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateStaff());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ full_name: 'New Staff', role: 'waiter' } as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.STAFF]);
  });

  it('calls db.staff.create with staff data', async () => {
    const staffData = { full_name: 'New Staff', role: 'waiter', email: 'n@t.com' } as any;
    const { result, mockDb } = renderHookWithProviders(() => useCreateStaff());
    await result.current.mutateAsync(staffData);
    expect(mockDb.staff.create).toHaveBeenCalledWith(staffData);
  });
});

describe('useUpdateStaff', () => {
  it('invalidates STAFF on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateStaff());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 's1', updates: { full_name: 'Updated' } as any });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.STAFF]);
  });

  it('calls db.staff.update with id and updates', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateStaff());
    await result.current.mutateAsync({ id: 's1', updates: { full_name: 'Updated' } as any });
    expect(mockDb.staff.update).toHaveBeenCalledWith('s1', { full_name: 'Updated' });
  });
});

describe('useDeleteStaff', () => {
  it('invalidates STAFF on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteStaff());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('s1');

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.STAFF]);
  });

  it('calls db.staff.delete with id', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useDeleteStaff());
    await result.current.mutateAsync('s1');
    expect(mockDb.staff.delete).toHaveBeenCalledWith('s1');
  });
});
