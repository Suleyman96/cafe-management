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
import { db } from '@/lib/supabase';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useTodaysTasks', () => {
  it('calls db.tasks.getTodaysTasks', () => {
    renderHookWithProviders(() => useTodaysTasks());
    expect(db.tasks.getTodaysTasks).toHaveBeenCalled();
  });
});

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

describe('useMyTasks', () => {
  it('calls findMyTasks with staffId', () => {
    renderHookWithProviders(() => useMyTasks('staff-1'));
    expect(db.tasks.findMyTasks).toHaveBeenCalledWith('staff-1');
  });

  it('is disabled when staffId is undefined', () => {
    renderHookWithProviders(() => useMyTasks(undefined));
    expect(db.tasks.findMyTasks).not.toHaveBeenCalled();
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
