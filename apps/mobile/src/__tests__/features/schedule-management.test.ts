import { QUERY_KEYS } from '@gustri/queries';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  useCreateSchedule,
  useDeleteSchedule,
  useMarkScheduleCompleted,
  useMarkScheduleInProgress,
  useSchedulesByDateRange,
} from '@/hooks/use-schedules';
import { createWrapper, renderHookWithProviders } from '../helpers/test-utils';

describe('Schedule management workflow', () => {
  it('useSchedulesByDateRange passes date strings to db', () => {
    const { mockDb } = renderHookWithProviders(() =>
      useSchedulesByDateRange('2024-01-15', '2024-01-21'),
    );
    expect(mockDb.schedules.findByDateRange).toHaveBeenCalledWith('2024-01-15', '2024-01-21');
  });

  it('useSchedulesByDateRange returns fetched data', async () => {
    const mockSchedules = [{ id: 's1', date: '2024-01-15', staff_id: 'staff-1' }];
    const { wrapper, mockDb } = createWrapper();
    (mockDb.schedules.findByDateRange as any).mockResolvedValueOnce(mockSchedules);

    const { result } = renderHook(() => useSchedulesByDateRange('2024-01-15', '2024-01-21'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.data).toEqual(mockSchedules));
  });

  it('useCreateSchedule invalidates schedule queries on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateSchedule());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({
      staff_id: 'staff-1',
      date: '2024-01-15',
      planned_start: '09:00',
      planned_end: '17:00',
    } as any);

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.SCHEDULES]);
  });

  it('useMarkScheduleInProgress sends id + actualStart ISO string', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useMarkScheduleInProgress());
    const actualStart = '2024-01-15T09:05:00.000Z';

    await result.current.mutateAsync({ id: 'sched-1', actualStart });

    expect(mockDb.schedules.markInProgress).toHaveBeenCalledWith('sched-1', actualStart);
  });

  it('useMarkScheduleCompleted sends id + optional actualEnd', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useMarkScheduleCompleted());
    const actualEnd = '2024-01-15T17:15:00.000Z';

    await result.current.mutateAsync({ id: 'sched-1', actualEnd });

    expect(mockDb.schedules.markCompleted).toHaveBeenCalledWith('sched-1', actualEnd);
  });

  it('useMarkScheduleCompleted works without actualEnd', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useMarkScheduleCompleted());

    await result.current.mutateAsync({ id: 'sched-1' });

    expect(mockDb.schedules.markCompleted).toHaveBeenCalledWith('sched-1', undefined);
  });

  it('useDeleteSchedule calls db.schedules.delete and invalidates', async () => {
    const { result, queryClient, mockDb } = renderHookWithProviders(() => useDeleteSchedule());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('sched-1');

    expect(mockDb.schedules.delete).toHaveBeenCalledWith('sched-1');
    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.SCHEDULES]);
  });

  it('getWeekDates returns 7 dates starting from Monday', () => {
    // Test the pure function logic (mirrors SchedulesScreen.tsx getWeekDates)
    function getWeekDates(referenceDate: Date) {
      const d = new Date(referenceDate);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(d);
      monday.setDate(d.getDate() + diff);
      const dates: Date[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        dates.push(date);
      }
      return dates;
    }

    // Wednesday Jan 17, 2024
    const dates = getWeekDates(new Date(2024, 0, 17));
    expect(dates).toHaveLength(7);
    // First date should be Monday (Jan 15)
    expect(dates[0].getDay()).toBe(1); // Monday
    expect(dates[0].getDate()).toBe(15);
    // Last date should be Sunday (Jan 21)
    expect(dates[6].getDay()).toBe(0); // Sunday
    expect(dates[6].getDate()).toBe(21);
  });
});
