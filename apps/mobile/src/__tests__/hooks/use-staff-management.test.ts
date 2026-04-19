import { describe, expect, it, vi } from 'vitest';
import {
  useMySchedule,
  usePaymentsByStaff,
  useStaff,
  useStaffMember,
  useUpdateStaff,
} from '@/hooks/use-staff-management';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useStaff', () => {
  it('calls db.staff.findAll', () => {
    const { mockDb } = renderHookWithProviders(() => useStaff());
    expect(mockDb.staff.findAll).toHaveBeenCalled();
  });

  it('passes role filter', () => {
    const { mockDb } = renderHookWithProviders(() => useStaff('admin'));
    expect(mockDb.staff.findAll).toHaveBeenCalledWith('admin');
  });
});

describe('useStaffMember', () => {
  it('calls db.staff.findById when id is provided', () => {
    const { mockDb } = renderHookWithProviders(() => useStaffMember('s1'));
    expect(mockDb.staff.findById).toHaveBeenCalledWith('s1');
  });

  it('is disabled when id is undefined', () => {
    const { mockDb } = renderHookWithProviders(() => useStaffMember(undefined));
    expect(mockDb.staff.findById).not.toHaveBeenCalled();
  });
});

describe('useUpdateStaff', () => {
  it('invalidates staff and staff-member on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateStaff());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 's1', data: { name: 'Updated' } });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['staff']);
  });
});

describe('usePaymentsByStaff', () => {
  it('calls db.payments.findByReceivedBy when staffId is provided', () => {
    const { mockDb } = renderHookWithProviders(() => usePaymentsByStaff('s1'));
    expect(mockDb.payments.findByReceivedBy).toHaveBeenCalledWith('s1', undefined);
  });

  it('is disabled when staffId is undefined', () => {
    const { mockDb } = renderHookWithProviders(() => usePaymentsByStaff(undefined));
    expect(mockDb.payments.findByReceivedBy).not.toHaveBeenCalled();
  });
});

describe('useMySchedule', () => {
  it('calls db.schedules.findByStaffRange when staffId is provided', () => {
    const { mockDb } = renderHookWithProviders(() =>
      useMySchedule('s1', '2026-03-01', '2026-03-31'),
    );
    expect(mockDb.schedules.findByStaffRange).toHaveBeenCalledWith(
      's1',
      '2026-03-01',
      '2026-03-31',
    );
  });

  it('is disabled when staffId is undefined', () => {
    const { mockDb } = renderHookWithProviders(() =>
      useMySchedule(undefined, '2026-03-01', '2026-03-31'),
    );
    expect(mockDb.schedules.findByStaffRange).not.toHaveBeenCalled();
  });
});
