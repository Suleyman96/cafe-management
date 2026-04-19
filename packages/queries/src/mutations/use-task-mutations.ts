import type { TaskInsert, TaskUpdate } from '@gustri/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateTasks } from '../invalidation';
import { useDb } from '../provider';

export function useCreateTask() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
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
  });
}

export function useUpdateTask() {
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
  });
}

export function useDeleteTask() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.tasks.delete(id),
    onSuccess: () => {
      invalidateTasks(queryClient);
    },
  });
}

export function useMarkTaskInProgress() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.tasks.markInProgress(id),
    onSuccess: () => {
      invalidateTasks(queryClient);
    },
  });
}

export function useMarkTaskCompleted() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.tasks.markCompleted(id),
    onSuccess: () => {
      invalidateTasks(queryClient);
    },
  });
}

export function useMarkTaskCancelled() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.tasks.markCancelled(id),
    onSuccess: () => {
      invalidateTasks(queryClient);
    },
  });
}

export function useGenerateRecurringTasks() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => db.tasks.generateRecurringTasks(date),
    onSuccess: () => {
      invalidateTasks(queryClient);
    },
  });
}
