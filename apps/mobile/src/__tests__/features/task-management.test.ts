import { QUERY_KEYS } from '@gustri/core';
import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  useCreateTask,
  useDeleteTask,
  useGenerateRecurringTasks,
  useMarkTaskCompleted,
  useMyTasks,
  useTodaysTasks,
} from '@/hooks/use-tasks';
import { getLocalDateString } from '@/lib/date-utils';
import { db } from '@/lib/supabase';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('Task management workflow', () => {
  it('useGenerateRecurringTasks sends correct date to DB', async () => {
    const today = getLocalDateString();
    const { result } = renderHookWithProviders(() => useGenerateRecurringTasks());
    await result.current.mutateAsync(today);

    expect(db.tasks.generateRecurringTasks).toHaveBeenCalledWith(today);
  });

  it('useTodaysTasks calls db.tasks.getTodaysTasks', () => {
    renderHookWithProviders(() => useTodaysTasks());
    expect(db.tasks.getTodaysTasks).toHaveBeenCalled();
  });

  it('useMyTasks is disabled when staffId is undefined', () => {
    renderHookWithProviders(() => useMyTasks(undefined));
    expect(db.tasks.findMyTasks).not.toHaveBeenCalled();
  });

  it('useMyTasks calls findMyTasks when staffId is provided', () => {
    renderHookWithProviders(() => useMyTasks('staff-1'));
    expect(db.tasks.findMyTasks).toHaveBeenCalledWith('staff-1');
  });

  it('useCreateTask invalidates all task queries on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateTask());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({
      title: 'Clean tables',
      priority: 'normal',
      status: 'pending',
    } as any);

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.TASKS]);
  });

  it('useMarkTaskCompleted calls db.tasks.markCompleted with id', async () => {
    const { result } = renderHookWithProviders(() => useMarkTaskCompleted());
    await result.current.mutateAsync('task-1');

    expect(db.tasks.markCompleted).toHaveBeenCalledWith('task-1');
  });

  it('useDeleteTask calls db.tasks.delete and invalidates', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteTask());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('task-1');

    expect(db.tasks.delete).toHaveBeenCalledWith('task-1');
    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.TASKS]);
  });

  it('useTodaysTasks returns fetched data', async () => {
    const mockTasks = [{ id: 't1', title: 'Restock', status: 'pending' }];
    (db.tasks.getTodaysTasks as any).mockResolvedValueOnce(mockTasks);

    const { result } = renderHookWithProviders(() => useTodaysTasks());
    await waitFor(() => expect(result.current.data).toEqual(mockTasks));
  });
});
