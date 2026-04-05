/**
 * Type-Safe Tasks Hooks
 */

import { getLocalDateString, QUERY_KEYS } from '@gustri/core';
import type { Database } from '@gustri/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateTasks, refetchTasks } from '@/lib/query-helpers';
import { db } from '@/lib/supabase/wrapped-client';

type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
type Task = Database['public']['Tables']['tasks']['Row'];
type TaskUpdate = Database['public']['Tables']['tasks']['Update'];

export function useTasks(options?: {
  status?: string;
  priority?: string;
  assignedTo?: string;
  dueBefore?: string;
  isTemplate?: boolean;
}) {
  return useQuery({
    queryKey: [QUERY_KEYS.TASKS, options],
    queryFn: async (): Promise<Task[]> => db.tasks.findAll(options),
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.TASK, id],
    queryFn: async (): Promise<Task> => db.tasks.findById(id),
    enabled: !!id,
  });
}

export function useMyTasks(staffId: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.TASKS, 'my', staffId],
    queryFn: async (): Promise<Task[]> => db.tasks.findMyTasks(staffId),
    enabled: !!staffId,
  });
}

export function useTodaysTasks() {
  return useQuery({
    queryKey: [QUERY_KEYS.TASKS, 'today'],
    queryFn: async (): Promise<Task[]> => db.tasks.getTodaysTasks(),
  });
}

export function useOverdueTasksCount() {
  return useQuery({
    queryKey: [QUERY_KEYS.OVERDUE_TASKS_COUNT],
    queryFn: async (): Promise<number> => db.tasks.getOverdueCount(),
  });
}

export function useOpenTasksCount() {
  return useQuery({
    queryKey: [QUERY_KEYS.OPEN_TASKS_COUNT],
    queryFn: async (): Promise<number> => db.tasks.getOpenTasksCount(),
  });
}

export function useRecurringTemplates() {
  return useQuery({
    queryKey: [QUERY_KEYS.TASKS, 'templates'],
    queryFn: async (): Promise<Task[]> => db.tasks.getRecurringTemplates(),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TaskInsert) => db.tasks.create(data),
    onSuccess: async (_result, data) => {
      if (data.is_recurring) {
        await db.tasks.generateRecurringTasks(getLocalDateString());
      }
      invalidateTasks(queryClient);
    },
    onSettled: () => {
      refetchTasks(queryClient);
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<TaskUpdate> }) =>
      db.tasks.update(id, updates),
    onSuccess: async (_result, { updates }) => {
      if (updates.is_recurring) {
        await db.tasks.generateRecurringTasks(getLocalDateString());
      }
      invalidateTasks(queryClient);
    },
    onSettled: () => {
      refetchTasks(queryClient);
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.tasks.delete(id),
    onSuccess: () => {
      invalidateTasks(queryClient);
    },
    onSettled: () => {
      refetchTasks(queryClient);
    },
  });
}

export function useMarkTaskInProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.tasks.markInProgress(id),
    onSuccess: () => {
      invalidateTasks(queryClient);
    },
    onSettled: () => {
      refetchTasks(queryClient);
    },
  });
}

export function useMarkTaskCompleted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.tasks.markCompleted(id),
    onSuccess: () => {
      invalidateTasks(queryClient);
    },
    onSettled: () => {
      refetchTasks(queryClient);
    },
  });
}

export function useMarkTaskCancelled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.tasks.markCancelled(id),
    onSuccess: () => {
      invalidateTasks(queryClient);
    },
    onSettled: () => {
      refetchTasks(queryClient);
    },
  });
}

export function useMyOpenTasksCount(staffId: string) {
  const { data: myTasks } = useMyTasks(staffId);
  return (myTasks || []).filter((t: any) => t.status === 'pending' || t.status === 'in_progress')
    .length;
}

export function useGenerateRecurringTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (date: string) => db.tasks.generateRecurringTasks(date),
    onSuccess: () => {
      invalidateTasks(queryClient);
    },
  });
}
