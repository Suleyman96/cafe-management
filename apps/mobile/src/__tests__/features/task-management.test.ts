import { QUERY_KEYS, tenantKey } from '@gustri/queries';
import { renderHook, waitFor } from '@testing-library/react';
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
import { createWrapper, renderHookWithProviders, TEST_TENANT_ID } from '../helpers/test-utils';

describe('Task management workflow', () => {
  it('useGenerateRecurringTasks sends correct date to DB', async () => {
    const today = getLocalDateString();
    const { result, mockDb } = renderHookWithProviders(() => useGenerateRecurringTasks());
    await result.current.mutateAsync(today);

    expect(mockDb.tasks.generateRecurringTasks).toHaveBeenCalledWith(today);
  });

  it('useTodaysTasks calls db.tasks.getTodaysTasks', () => {
    const { mockDb } = renderHookWithProviders(() => useTodaysTasks());
    expect(mockDb.tasks.getTodaysTasks).toHaveBeenCalled();
  });

  it('useMyTasks is disabled when staffId is undefined', () => {
    const { mockDb } = renderHookWithProviders(() => useMyTasks(undefined));
    expect(mockDb.tasks.findMyTasks).not.toHaveBeenCalled();
  });

  it('useMyTasks calls findMyTasks when staffId is provided', () => {
    const { mockDb } = renderHookWithProviders(() => useMyTasks('staff-1'));
    expect(mockDb.tasks.findMyTasks).toHaveBeenCalledWith('staff-1');
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
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TASKS));
  });

  it('useMarkTaskCompleted calls db.tasks.markCompleted with id', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useMarkTaskCompleted());
    await result.current.mutateAsync('task-1');

    expect(mockDb.tasks.markCompleted).toHaveBeenCalledWith('task-1');
  });

  it('useDeleteTask calls db.tasks.delete and invalidates', async () => {
    const { result, queryClient, mockDb } = renderHookWithProviders(() => useDeleteTask());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('task-1');

    expect(mockDb.tasks.delete).toHaveBeenCalledWith('task-1');
    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.TASKS));
  });

  it('useTodaysTasks returns fetched data', async () => {
    const mockTasks = [{ id: 't1', title: 'Restock', status: 'pending' }];
    const { wrapper, mockDb } = createWrapper();
    (mockDb.tasks.getTodaysTasks as any).mockResolvedValueOnce(mockTasks);

    const { result } = renderHook(() => useTodaysTasks(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(mockTasks));
  });
});
