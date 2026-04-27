import { QUERY_KEYS } from '@gustri/core';
import { describe, expect, it, vi } from 'vitest';
import {
  useCreateTask,
  useDeleteTask,
  useGenerateRecurringTasks,
  useMarkTaskCancelled,
  useMarkTaskCompleted,
  useMarkTaskInProgress,
  useUpdateTask,
} from '../../mutations/use-task-mutations';
import { renderHookWithProviders } from '../helpers/test-utils';

function getInvalidatedKeys(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.map((c: any) => (c[0] as any).queryKey);
}

describe('useCreateTask', () => {
  it('calls db.tasks.create with the data', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useCreateTask());
    const data = { title: 'Restock' } as any;
    await result.current.mutateAsync(data);
    expect(mockDb.tasks.create).toHaveBeenCalledWith(data);
  });

  it('does NOT generate recurring instances when is_recurring is false/missing', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useCreateTask());
    await result.current.mutateAsync({ title: 'Once' } as any);
    expect(mockDb.tasks.generateRecurringTasks).not.toHaveBeenCalled();
  });

  it('generates recurring instances when is_recurring is true', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useCreateTask());
    await result.current.mutateAsync({ title: 'Daily', is_recurring: true } as any);
    expect(mockDb.tasks.generateRecurringTasks).toHaveBeenCalled();
  });

  it('invalidates tasks on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateTask());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({} as any);
    expect(getInvalidatedKeys(spy)).toContainEqual([QUERY_KEYS.TASKS]);
  });
});

describe('useUpdateTask', () => {
  it('calls db.tasks.update with id + updates', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateTask());
    await result.current.mutateAsync({ id: 't1', updates: { title: 'X' } });
    expect(mockDb.tasks.update).toHaveBeenCalledWith('t1', { title: 'X' });
  });

  it('regenerates recurring instances when is_recurring changes', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateTask());
    await result.current.mutateAsync({ id: 't1', updates: { is_recurring: true } });
    expect(mockDb.tasks.generateRecurringTasks).toHaveBeenCalled();
  });

  it('does not regenerate when is_recurring is omitted', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateTask());
    await result.current.mutateAsync({ id: 't1', updates: { title: 'X' } });
    expect(mockDb.tasks.generateRecurringTasks).not.toHaveBeenCalled();
  });
});

describe('useDeleteTask', () => {
  it('forwards id', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useDeleteTask());
    await result.current.mutateAsync('t1');
    expect(mockDb.tasks.delete).toHaveBeenCalledWith('t1');
  });
});

describe('task status transitions', () => {
  it('useMarkTaskInProgress forwards id', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useMarkTaskInProgress());
    await result.current.mutateAsync('t1');
    expect(mockDb.tasks.markInProgress).toHaveBeenCalledWith('t1');
  });

  it('useMarkTaskCompleted forwards id', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useMarkTaskCompleted());
    await result.current.mutateAsync('t1');
    expect(mockDb.tasks.markCompleted).toHaveBeenCalledWith('t1');
  });

  it('useMarkTaskCancelled forwards id', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useMarkTaskCancelled());
    await result.current.mutateAsync('t1');
    expect(mockDb.tasks.markCancelled).toHaveBeenCalledWith('t1');
  });
});

describe('useGenerateRecurringTasks', () => {
  it('forwards date string', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useGenerateRecurringTasks());
    await result.current.mutateAsync('2026-04-26');
    expect(mockDb.tasks.generateRecurringTasks).toHaveBeenCalledWith('2026-04-26');
  });
});
