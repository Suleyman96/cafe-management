import { QUERY_KEYS } from '@cafe-idare/core';
import { describe, expect, it, vi } from 'vitest';
import {
  useCreateTask,
  useDeleteTask,
  useGenerateRecurringTasks,
  useMarkTaskCancelled,
  useMarkTaskCompleted,
  useMarkTaskInProgress,
  useMyTasks,
  useOverdueTasksCount,
  useRecurringTemplates,
  useTask,
  useTasks,
  useTodaysTasks,
  useUpdateTask,
} from '@/hooks/use-tasks-safe';
import { db } from '@/lib/supabase/wrapped-client';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useTasks', () => {
  it('calls db.tasks.findAll', () => {
    renderHookWithProviders(() => useTasks());
    expect(db.tasks.findAll).toHaveBeenCalled();
  });

  it('passes options to findAll', () => {
    const opts = { status: 'pending', priority: 'high' };
    renderHookWithProviders(() => useTasks(opts));
    expect(db.tasks.findAll).toHaveBeenCalledWith(opts);
  });
});

describe('useTask', () => {
  it('calls findById', () => {
    renderHookWithProviders(() => useTask('task-1'));
    expect(db.tasks.findById).toHaveBeenCalledWith('task-1');
  });

  it('is disabled when id is empty', () => {
    renderHookWithProviders(() => useTask(''));
    expect(db.tasks.findById).not.toHaveBeenCalled();
  });
});

describe('useMyTasks', () => {
  it('calls findMyTasks with staffId', () => {
    renderHookWithProviders(() => useMyTasks('staff-1'));
    expect(db.tasks.findMyTasks).toHaveBeenCalledWith('staff-1');
  });

  it('is disabled when staffId is empty', () => {
    renderHookWithProviders(() => useMyTasks(''));
    expect(db.tasks.findMyTasks).not.toHaveBeenCalled();
  });
});

describe('useTodaysTasks', () => {
  it('calls getTodaysTasks', () => {
    renderHookWithProviders(() => useTodaysTasks());
    expect(db.tasks.getTodaysTasks).toHaveBeenCalled();
  });
});

describe('useOverdueTasksCount', () => {
  it('calls getOverdueCount', () => {
    renderHookWithProviders(() => useOverdueTasksCount());
    expect(db.tasks.getOverdueCount).toHaveBeenCalled();
  });
});

describe('useRecurringTemplates', () => {
  it('calls getRecurringTemplates', () => {
    renderHookWithProviders(() => useRecurringTemplates());
    expect(db.tasks.getRecurringTemplates).toHaveBeenCalled();
  });
});

describe('useCreateTask', () => {
  it('invalidates TASKS and OVERDUE_TASKS_COUNT on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateTask());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ title: 'Test task' } as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.TASKS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.OVERDUE_TASKS_COUNT]);
  });
});

describe('useUpdateTask', () => {
  it('invalidates TASKS and OVERDUE_TASKS_COUNT on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateTask());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 'task-1', updates: { title: 'Updated' } as any });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.TASKS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.OVERDUE_TASKS_COUNT]);
  });
});

describe('useDeleteTask', () => {
  it('invalidates TASKS and OVERDUE_TASKS_COUNT on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteTask());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('task-1');

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.TASKS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.OVERDUE_TASKS_COUNT]);
  });
});

describe('useMarkTaskInProgress', () => {
  it('invalidates TASKS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMarkTaskInProgress());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('task-1');

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.TASKS]);
  });
});

describe('useMarkTaskCompleted', () => {
  it('invalidates TASKS and OVERDUE_TASKS_COUNT on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMarkTaskCompleted());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('task-1');

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.TASKS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.OVERDUE_TASKS_COUNT]);
  });
});

describe('useMarkTaskCancelled', () => {
  it('invalidates TASKS and OVERDUE_TASKS_COUNT on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMarkTaskCancelled());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('task-1');

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.TASKS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.OVERDUE_TASKS_COUNT]);
  });
});

describe('useGenerateRecurringTasks', () => {
  it('invalidates TASKS and OVERDUE_TASKS_COUNT on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useGenerateRecurringTasks());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('2026-02-25');

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.TASKS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.OVERDUE_TASKS_COUNT]);
  });
});
