import type { TaskInsert, TaskUpdate } from '@gustri/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrCreateClientRequestId } from '../idempotency';
import { invalidateTasks } from '../invalidation';
import { useDb } from '../provider';
import type { MutationCallbacks } from './types';

export function useCreateTask(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    onMutate: (data: TaskInsert) => {
      data.client_request_id = getOrCreateClientRequestId(data.client_request_id);
    },
    mutationFn: async (data: TaskInsert) => {
      const task = await db.tasks.create(data);
      if (data.is_recurring) {
        await db.tasks.generateRecurringTasks(new Date().toISOString().split('T')[0]);
      }
      return task;
    },
    onSuccess: () => {
      invalidateTasks(queryClient);
    },
    onError: options?.onError,
  });
}

export function useUpdateTask(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TaskUpdate> }) => {
      const task = await db.tasks.update(id, updates);
      if (updates.is_recurring !== undefined) {
        await db.tasks.generateRecurringTasks(new Date().toISOString().split('T')[0]);
      }
      return task;
    },
    onSuccess: () => {
      invalidateTasks(queryClient);
    },
    onError: options?.onError,
  });
}

export function useDeleteTask(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.tasks.delete(id),
    onSuccess: () => {
      invalidateTasks(queryClient);
    },
    onError: options?.onError,
  });
}

export function useMarkTaskInProgress(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.tasks.markInProgress(id),
    onSuccess: () => {
      invalidateTasks(queryClient);
    },
    onError: options?.onError,
  });
}

export function useMarkTaskCompleted(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.tasks.markCompleted(id),
    onSuccess: () => {
      invalidateTasks(queryClient);
    },
    onError: options?.onError,
  });
}

export function useMarkTaskCancelled(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.tasks.markCancelled(id),
    onSuccess: () => {
      invalidateTasks(queryClient);
    },
    onError: options?.onError,
  });
}

export function useGenerateRecurringTasks(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => db.tasks.generateRecurringTasks(date),
    onSuccess: () => {
      invalidateTasks(queryClient);
    },
    onError: options?.onError,
  });
}
