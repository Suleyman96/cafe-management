import { describe, expect, it, vi } from 'vitest';
import {
  useCreateSchedule,
  useDeleteSchedule,
  useMarkScheduleCompleted,
  useMarkScheduleInProgress,
  useSchedulesByDate,
  useSchedulesByDateRange,
  useUpdateSchedule,
} from '@/hooks/use-schedules';
import { db } from '@/lib/supabase';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useSchedulesByDateRange', () => {
  it('calls db.schedules.findByDateRange', () => {
    renderHookWithProviders(() => useSchedulesByDateRange('2026-03-01', '2026-03-31'));
    expect(db.schedules.findByDateRange).toHaveBeenCalledWith('2026-03-01', '2026-03-31');
  });
});

describe('useSchedulesByDate', () => {
  it('calls db.schedules.findByDate', () => {
    renderHookWithProviders(() => useSchedulesByDate('2026-03-19'));
    expect(db.schedules.findByDate).toHaveBeenCalledWith('2026-03-19');
  });
});

describe('useCreateSchedule', () => {
  it('invalidates schedules on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateSchedule());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ staff_id: 's1', date: '2026-03-20' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['schedules']);
  });
});

describe('useUpdateSchedule', () => {
  it('invalidates schedules on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateSchedule());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 'sch1', data: { notes: 'Updated' } });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['schedules']);
  });
});

describe('useDeleteSchedule', () => {
  it('invalidates schedules on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteSchedule());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('sch1');

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['schedules']);
  });
});

describe('useMarkScheduleInProgress', () => {
  it('invalidates schedules on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMarkScheduleInProgress());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 'sch1', actualStart: '2026-03-19T09:00:00' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['schedules']);
  });
});

describe('useMarkScheduleCompleted', () => {
  it('invalidates schedules on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMarkScheduleCompleted());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 'sch1', actualEnd: '2026-03-19T17:00:00' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['schedules']);
  });
});
