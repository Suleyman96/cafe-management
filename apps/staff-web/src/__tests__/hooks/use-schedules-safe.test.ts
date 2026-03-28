import { QUERY_KEYS } from '@gustri/core';
import {
  useCreateSchedule,
  useDeleteSchedule,
  useMySchedule,
  useMyScheduleToday,
  useSchedulesByDate,
  useSchedulesByDateRange,
  useUpdateSchedule,
} from '@/hooks/use-schedules-safe';
import { db } from '@/lib/supabase/wrapped-client';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useSchedulesByDate', () => {
  it('calls db.schedules.findByDate with the date', () => {
    renderHookWithProviders(() => useSchedulesByDate('2024-01-15'));
    expect(db.schedules.findByDate).toHaveBeenCalledWith('2024-01-15');
  });

  it('is disabled when date is empty', () => {
    renderHookWithProviders(() => useSchedulesByDate(''));
    expect(db.schedules.findByDate).not.toHaveBeenCalled();
  });
});

describe('useSchedulesByDateRange', () => {
  it('calls db.schedules.findByDateRange with start and end dates', () => {
    renderHookWithProviders(() => useSchedulesByDateRange('2024-01-01', '2024-01-31'));
    expect(db.schedules.findByDateRange).toHaveBeenCalledWith('2024-01-01', '2024-01-31');
  });

  it('is disabled when startDate is empty', () => {
    renderHookWithProviders(() => useSchedulesByDateRange('', '2024-01-31'));
    expect(db.schedules.findByDateRange).not.toHaveBeenCalled();
  });

  it('is disabled when endDate is empty', () => {
    renderHookWithProviders(() => useSchedulesByDateRange('2024-01-01', ''));
    expect(db.schedules.findByDateRange).not.toHaveBeenCalled();
  });
});

describe('useMySchedule', () => {
  it('calls db.schedules.findByStaffRange with staffId and date range', () => {
    renderHookWithProviders(() => useMySchedule('s1', '2024-01-01', '2024-01-31'));
    expect(db.schedules.findByStaffRange).toHaveBeenCalledWith('s1', '2024-01-01', '2024-01-31');
  });

  it('is disabled when staffId is empty', () => {
    renderHookWithProviders(() => useMySchedule('', '2024-01-01', '2024-01-31'));
    expect(db.schedules.findByStaffRange).not.toHaveBeenCalled();
  });

  it('is disabled when startDate is empty', () => {
    renderHookWithProviders(() => useMySchedule('s1', '', '2024-01-31'));
    expect(db.schedules.findByStaffRange).not.toHaveBeenCalled();
  });
});

describe('useMyScheduleToday', () => {
  it('calls db.schedules.findByStaffAndDate with staffId and today', () => {
    const today = new Date().toLocaleDateString('en-CA');
    renderHookWithProviders(() => useMyScheduleToday('s1'));
    expect(db.schedules.findByStaffAndDate).toHaveBeenCalledWith('s1', today);
  });

  it('is disabled when staffId is empty', () => {
    renderHookWithProviders(() => useMyScheduleToday(''));
    expect(db.schedules.findByStaffAndDate).not.toHaveBeenCalled();
  });
});

describe('useCreateSchedule', () => {
  it('calls db.schedules.create with data', async () => {
    const data = { staff_id: 's1', date: '2024-01-15', shift_start: '09:00', shift_end: '17:00' };
    const { result } = renderHookWithProviders(() => useCreateSchedule());
    await result.current.mutateAsync(data as any);
    expect(db.schedules.create).toHaveBeenCalledWith(data);
  });

  it('invalidates schedules and my_schedule on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateSchedule());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ staff_id: 's1', date: '2024-01-15' } as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.SCHEDULES]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.MY_SCHEDULE]);
  });
});

describe('useUpdateSchedule', () => {
  it('calls db.schedules.update with id and data', async () => {
    const data = { shift_start: '10:00' };
    const { result } = renderHookWithProviders(() => useUpdateSchedule());
    await result.current.mutateAsync({ id: 'sched-1', data } as any);
    expect(db.schedules.update).toHaveBeenCalledWith('sched-1', data);
  });

  it('invalidates schedules and my_schedule on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateSchedule());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 'sched-1', data: {} } as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.SCHEDULES]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.MY_SCHEDULE]);
  });
});

describe('useDeleteSchedule', () => {
  it('calls db.schedules.delete with id', async () => {
    const { result } = renderHookWithProviders(() => useDeleteSchedule());
    await result.current.mutateAsync('sched-1');
    expect(db.schedules.delete).toHaveBeenCalledWith('sched-1');
  });

  it('invalidates schedules and my_schedule on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteSchedule());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('sched-1');

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.SCHEDULES]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.MY_SCHEDULE]);
  });
});
