import { describe, expect, it, vi } from 'vitest';
import {
  useMySchedule,
  usePaymentsByStaff,
  useStaff,
  useStaffMember,
  useUpdateStaff,
} from '@/hooks/use-staff-management';
import { db } from '@/lib/supabase';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useStaff', () => {
  it('calls db.staff.findAll', () => {
    renderHookWithProviders(() => useStaff());
    expect(db.staff.findAll).toHaveBeenCalled();
  });

  it('passes role filter', () => {
    renderHookWithProviders(() => useStaff('admin'));
    expect(db.staff.findAll).toHaveBeenCalledWith('admin');
  });
});

describe('useStaffMember', () => {
  it('calls db.staff.findById when id is provided', () => {
    renderHookWithProviders(() => useStaffMember('s1'));
    expect(db.staff.findById).toHaveBeenCalledWith('s1');
  });

  it('is disabled when id is undefined', () => {
    renderHookWithProviders(() => useStaffMember(undefined));
    expect(db.staff.findById).not.toHaveBeenCalled();
  });
});

describe('useUpdateStaff', () => {
  it('invalidates staff and staff-member on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateStaff());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 's1', data: { name: 'Updated' } });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['staff']);
    expect(keys).toContainEqual(['staff_member']);
  });
});

describe('usePaymentsByStaff', () => {
  it('calls db.payments.findByReceivedBy when staffId is provided', () => {
    renderHookWithProviders(() => usePaymentsByStaff('s1'));
    expect(db.payments.findByReceivedBy).toHaveBeenCalledWith('s1', undefined);
  });

  it('is disabled when staffId is undefined', () => {
    renderHookWithProviders(() => usePaymentsByStaff(undefined));
    expect(db.payments.findByReceivedBy).not.toHaveBeenCalled();
  });
});

describe('useMySchedule', () => {
  it('calls db.schedules.findByStaffRange when staffId is provided', () => {
    renderHookWithProviders(() => useMySchedule('s1', '2026-03-01', '2026-03-31'));
    expect(db.schedules.findByStaffRange).toHaveBeenCalledWith('s1', '2026-03-01', '2026-03-31');
  });

  it('is disabled when staffId is undefined', () => {
    renderHookWithProviders(() => useMySchedule(undefined, '2026-03-01', '2026-03-31'));
    expect(db.schedules.findByStaffRange).not.toHaveBeenCalled();
  });
});
