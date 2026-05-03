import { QUERY_KEYS, tenantKey } from '@gustri/queries';
import {
  useCreateSchedule,
  useDeleteSchedule,
  useMySchedule,
  useMyScheduleToday,
  useSchedulesByDate,
  useSchedulesByDateRange,
  useUpdateSchedule,
} from '@/hooks/use-schedules-safe';
import { renderHookWithProviders, TEST_TENANT_ID } from '../helpers/test-utils';

describe('useSchedulesByDate', () => {
  it('calls db.schedules.findByDate with the date', () => {
    const { mockDb } = renderHookWithProviders(() => useSchedulesByDate('2024-01-15'));
    expect(mockDb.schedules.findByDate).toHaveBeenCalledWith('2024-01-15');
  });

  it('is disabled when date is empty', () => {
    const { mockDb } = renderHookWithProviders(() => useSchedulesByDate(''));
    expect(mockDb.schedules.findByDate).not.toHaveBeenCalled();
  });
});

describe('useSchedulesByDateRange', () => {
  it('calls db.schedules.findByDateRange with start and end dates', () => {
    const { mockDb } = renderHookWithProviders(() =>
      useSchedulesByDateRange('2024-01-01', '2024-01-31'),
    );
    expect(mockDb.schedules.findByDateRange).toHaveBeenCalledWith('2024-01-01', '2024-01-31');
  });

  it('is disabled when startDate is empty', () => {
    const { mockDb } = renderHookWithProviders(() => useSchedulesByDateRange('', '2024-01-31'));
    expect(mockDb.schedules.findByDateRange).not.toHaveBeenCalled();
  });

  it('is disabled when endDate is empty', () => {
    const { mockDb } = renderHookWithProviders(() => useSchedulesByDateRange('2024-01-01', ''));
    expect(mockDb.schedules.findByDateRange).not.toHaveBeenCalled();
  });
});

describe('useMySchedule', () => {
  it('calls db.schedules.findByStaffRange with staffId and date range', () => {
    const { mockDb } = renderHookWithProviders(() =>
      useMySchedule('s1', '2024-01-01', '2024-01-31'),
    );
    expect(mockDb.schedules.findByStaffRange).toHaveBeenCalledWith(
      's1',
      '2024-01-01',
      '2024-01-31',
    );
  });

  it('is disabled when staffId is empty', () => {
    const { mockDb } = renderHookWithProviders(() => useMySchedule('', '2024-01-01', '2024-01-31'));
    expect(mockDb.schedules.findByStaffRange).not.toHaveBeenCalled();
  });

  it('is disabled when startDate is empty', () => {
    const { mockDb } = renderHookWithProviders(() => useMySchedule('s1', '', '2024-01-31'));
    expect(mockDb.schedules.findByStaffRange).not.toHaveBeenCalled();
  });
});

describe('useMyScheduleToday', () => {
  it('calls db.schedules.findByStaffAndDate with staffId and today', () => {
    const today = new Date().toLocaleDateString('en-CA');
    const { mockDb } = renderHookWithProviders(() => useMyScheduleToday('s1'));
    expect(mockDb.schedules.findByStaffAndDate).toHaveBeenCalledWith('s1', today);
  });

  it('is disabled when staffId is empty', () => {
    const { mockDb } = renderHookWithProviders(() => useMyScheduleToday(''));
    expect(mockDb.schedules.findByStaffAndDate).not.toHaveBeenCalled();
  });
});

describe('useCreateSchedule', () => {
  it('calls db.schedules.create with data', async () => {
    const data = { staff_id: 's1', date: '2024-01-15', shift_start: '09:00', shift_end: '17:00' };
    const { result, mockDb } = renderHookWithProviders(() => useCreateSchedule());
    await result.current.mutateAsync(data as any);
    expect(mockDb.schedules.create).toHaveBeenCalledWith(data);
  });

  it('invalidates schedules and my_schedule on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateSchedule());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ staff_id: 's1', date: '2024-01-15' } as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.SCHEDULES));
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.MY_SCHEDULE));
  });
});

describe('useUpdateSchedule', () => {
  it('calls db.schedules.update with id and data', async () => {
    const data = { shift_start: '10:00' };
    const { result, mockDb } = renderHookWithProviders(() => useUpdateSchedule());
    await result.current.mutateAsync({ id: 'sched-1', data } as any);
    expect(mockDb.schedules.update).toHaveBeenCalledWith('sched-1', data);
  });

  it('invalidates schedules and my_schedule on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateSchedule());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 'sched-1', data: {} } as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.SCHEDULES));
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.MY_SCHEDULE));
  });
});

describe('useDeleteSchedule', () => {
  it('calls db.schedules.delete with id', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useDeleteSchedule());
    await result.current.mutateAsync('sched-1');
    expect(mockDb.schedules.delete).toHaveBeenCalledWith('sched-1');
  });

  it('invalidates schedules and my_schedule on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteSchedule());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('sched-1');

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.SCHEDULES));
    expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.MY_SCHEDULE));
  });
});
