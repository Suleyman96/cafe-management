import { getLocalDateString, QUERY_KEYS } from '@gustri/core';
import type { TaskInsert, TaskUpdate } from '@gustri/database';
import type { QueryClient } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';
import type { Task } from '@/types';

function invalidateAllTasks(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.OVERDUE_TASKS_COUNT] });
  qc.invalidateQueries({ queryKey: [QUERY_KEYS.OPEN_TASKS_COUNT] });
}

export function useTodaysTasks() {
  return useQuery({
    queryKey: [QUERY_KEYS.TASKS, 'today'],
    queryFn: async (): Promise<Task[]> => db.tasks.getTodaysTasks(),
  });
}

export function useTasks(options?: { status?: string; priority?: string; isTemplate?: boolean }) {
  return useQuery({
    queryKey: [QUERY_KEYS.TASKS, options],
    queryFn: async (): Promise<Task[]> => db.tasks.findAll(options),
  });
}

export function useMyTasks(staffId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.TASKS, 'my', staffId],
    queryFn: async (): Promise<Task[]> => db.tasks.findMyTasks(staffId!),
    enabled: !!staffId,
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
      invalidateAllTasks(queryClient);
    },
    onError: (error: Error) => {
      console.error('Failed to create task:', error.message);
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
      invalidateAllTasks(queryClient);
    },
    onError: (error: Error) => {
      console.error('Failed to update task:', error.message);
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.tasks.delete(id),
    onSuccess: () => {
      invalidateAllTasks(queryClient);
    },
    onError: (error: Error) => {
      console.error('Failed to delete task:', error.message);
    },
  });
}

export function useMarkTaskInProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.tasks.markInProgress(id),
    onSuccess: () => {
      invalidateAllTasks(queryClient);
    },
    onError: (error: Error) => {
      console.error('Failed to mark task in progress:', error.message);
    },
  });
}

export function useMarkTaskCompleted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.tasks.markCompleted(id),
    onSuccess: () => {
      invalidateAllTasks(queryClient);
    },
    onError: (error: Error) => {
      console.error('Failed to mark task completed:', error.message);
    },
  });
}

export function useMarkTaskCancelled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.tasks.markCancelled(id),
    onSuccess: () => {
      invalidateAllTasks(queryClient);
    },
    onError: (error: Error) => {
      console.error('Failed to mark task cancelled:', error.message);
    },
  });
}

export function useMyOpenTasksCount(staffId: string | undefined) {
  const { data: myTasks } = useMyTasks(staffId);
  return (myTasks || []).filter((t: any) => t.status === 'pending' || t.status === 'in_progress')
    .length;
}

export function useGenerateRecurringTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (date: string) => db.tasks.generateRecurringTasks(date),
    onSuccess: () => {
      invalidateAllTasks(queryClient);
    },
    onError: (error: Error) => {
      console.error('Failed to generate recurring tasks:', error.message);
    },
  });
}
