import { describe, expect, it, vi } from 'vitest';
import { QUERY_KEYS } from '../../keys';
import {
  useCreateSchedule,
  useDeleteSchedule,
  useMarkScheduleCompleted,
  useMarkScheduleInProgress,
  useUpdateSchedule,
} from '../../mutations/use-schedule-mutations';
import { renderHookWithProviders } from '../helpers/test-utils';

function getInvalidatedKeys(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.map((c: any) => (c[0] as any).queryKey);
}

describe('useCreateSchedule', () => {
  it('calls db.schedules.create', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useCreateSchedule());
    const data = { staff_id: 's1', date: '2026-04-26' } as any;
    await result.current.mutateAsync(data);
    expect(mockDb.schedules.create).toHaveBeenCalledWith(data);
  });

  it('invalidates schedules', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateSchedule());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({} as any);
    expect(getInvalidatedKeys(spy)).toContainEqual([QUERY_KEYS.SCHEDULES]);
  });
});

describe('useUpdateSchedule', () => {
  it('forwards id + updates', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateSchedule());
    await result.current.mutateAsync({ id: 'sc1', updates: { date: '2026-04-27' } as any });
    expect(mockDb.schedules.update).toHaveBeenCalledWith('sc1', { date: '2026-04-27' });
  });
});

describe('useDeleteSchedule', () => {
  it('forwards id', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useDeleteSchedule());
    await result.current.mutateAsync('sc1');
    expect(mockDb.schedules.delete).toHaveBeenCalledWith('sc1');
  });
});

describe('useMarkScheduleInProgress', () => {
  it('forwards id and actualStart timestamp', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useMarkScheduleInProgress());
    await result.current.mutateAsync({ id: 'sc1', actualStart: '2026-04-26T09:00:00Z' });
    expect(mockDb.schedules.markInProgress).toHaveBeenCalledWith('sc1', '2026-04-26T09:00:00Z');
  });
});

describe('useMarkScheduleCompleted', () => {
  it('forwards id and optional actualEnd', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useMarkScheduleCompleted());
    await result.current.mutateAsync({ id: 'sc1', actualEnd: '2026-04-26T17:00:00Z' });
    expect(mockDb.schedules.markCompleted).toHaveBeenCalledWith('sc1', '2026-04-26T17:00:00Z');
  });

  it('works without actualEnd', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useMarkScheduleCompleted());
    await result.current.mutateAsync({ id: 'sc1' });
    expect(mockDb.schedules.markCompleted).toHaveBeenCalledWith('sc1', undefined);
  });
});
