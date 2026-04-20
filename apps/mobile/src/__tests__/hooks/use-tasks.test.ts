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
  useTasks,
  useTodaysTasks,
} from '@/hooks/use-tasks';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useTodaysTasks', () => {
  it('calls db.tasks.getTodaysTasks', () => {
    const { mockDb } = renderHookWithProviders(() => useTodaysTasks());
    expect(mockDb.tasks.getTodaysTasks).toHaveBeenCalled();
  });
});

describe('useTasks', () => {
  it('calls db.tasks.findAll', () => {
    const { mockDb } = renderHookWithProviders(() => useTasks());
    expect(mockDb.tasks.findAll).toHaveBeenCalled();
  });

  it('passes options to findAll', () => {
    const opts = { status: 'pending', priority: 'high' };
    const { mockDb } = renderHookWithProviders(() => useTasks(opts));
    expect(mockDb.tasks.findAll).toHaveBeenCalledWith(opts);
  });
});

describe('useMyTasks', () => {
  it('calls findMyTasks with staffId', () => {
    const { mockDb } = renderHookWithProviders(() => useMyTasks('staff-1'));
    expect(mockDb.tasks.findMyTasks).toHaveBeenCalledWith('staff-1');
  });

  it('is disabled when staffId is undefined', () => {
    const { mockDb } = renderHookWithProviders(() => useMyTasks(undefined));
    expect(mockDb.tasks.findMyTasks).not.toHaveBeenCalled();
  });
});

describe('useOverdueTasksCount', () => {
  it('calls getOverdueCount', () => {
    const { mockDb } = renderHookWithProviders(() => useOverdueTasksCount());
    expect(mockDb.tasks.getOverdueCount).toHaveBeenCalled();
  });
});

describe('useRecurringTemplates', () => {
  it('calls getRecurringTemplates', () => {
    const { mockDb } = renderHookWithProviders(() => useRecurringTemplates());
    expect(mockDb.tasks.getRecurringTemplates).toHaveBeenCalled();
  });
});

describe('useCreateTask', () => {
  it('invalidates tasks on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateTask());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ title: 'Test task' } as any);

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['tasks']);
  });
});

describe('useDeleteTask', () => {
  it('invalidates tasks on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteTask());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('task-1');

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['tasks']);
  });
});

describe('useMarkTaskInProgress', () => {
  it('invalidates tasks on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMarkTaskInProgress());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('task-1');

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['tasks']);
  });
});

describe('useMarkTaskCompleted', () => {
  it('invalidates tasks on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMarkTaskCompleted());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('task-1');

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['tasks']);
  });
});

describe('useMarkTaskCancelled', () => {
  it('invalidates tasks on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMarkTaskCancelled());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('task-1');

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['tasks']);
  });
});

describe('useGenerateRecurringTasks', () => {
  it('invalidates tasks on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useGenerateRecurringTasks());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('2026-03-19');

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['tasks']);
  });
});
