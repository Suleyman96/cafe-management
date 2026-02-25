import { QUERY_KEYS } from '@cafe-idare/core';
import { describe, expect, it, vi } from 'vitest';
import {
  useActiveWaiters,
  useCreateStaff,
  useDeleteStaff,
  useStaff,
  useStaffByEmail,
  useStaffMember,
  useUpdateStaff,
} from '@/hooks/use-staff-safe';
import { db } from '@/lib/supabase/wrapped-client';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useStaff', () => {
  it('calls db.staff.findAll with no args when no role given', () => {
    renderHookWithProviders(() => useStaff());
    expect(db.staff.findAll).toHaveBeenCalledWith(undefined);
  });

  it('passes role to findAll when given', () => {
    renderHookWithProviders(() => useStaff('ADMIN' as any));
    expect(db.staff.findAll).toHaveBeenCalled();
  });
});

describe('useActiveWaiters', () => {
  it('calls getActiveWaiters', () => {
    renderHookWithProviders(() => useActiveWaiters());
    expect(db.staff.getActiveWaiters).toHaveBeenCalled();
  });
});

describe('useStaffMember', () => {
  it('calls findById with id', () => {
    renderHookWithProviders(() => useStaffMember('s1'));
    expect(db.staff.findById).toHaveBeenCalledWith('s1');
  });

  it('is disabled when id is empty', () => {
    renderHookWithProviders(() => useStaffMember(''));
    expect(db.staff.findById).not.toHaveBeenCalled();
  });
});

describe('useStaffByEmail', () => {
  it('calls findByEmail', () => {
    renderHookWithProviders(() => useStaffByEmail('test@test.com'));
    expect(db.staff.findByEmail).toHaveBeenCalledWith('test@test.com');
  });

  it('is disabled when email is empty', () => {
    renderHookWithProviders(() => useStaffByEmail(''));
    expect(db.staff.findByEmail).not.toHaveBeenCalled();
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
});

describe('useUpdateStaff', () => {
  it('invalidates STAFF and specific staff member on success', async () => {
    (db.staff.update as any).mockResolvedValueOnce({ id: 's1' });

    const { result, queryClient } = renderHookWithProviders(() => useUpdateStaff());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 's1', updates: { full_name: 'Updated' } as any });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.STAFF]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.STAFF, 's1']);
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
});
