import { QUERY_KEYS } from '@gustri/core';
import type { TaskInsert, TaskUpdate } from '@gustri/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';
import type { Task } from '@/types';

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

export function useRecurringTemplates() {
  return useQuery({
    queryKey: [QUERY_KEYS.TASKS, 'recurring'],
    queryFn: async (): Promise<Task[]> => db.tasks.getRecurringTemplates(),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TaskInsert) => db.tasks.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
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
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
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
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
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
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
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
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
    },
    onError: (error: Error) => {
      console.error('Failed to mark task cancelled:', error.message);
    },
  });
}

export function useGenerateRecurringTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (date: string) => db.tasks.generateRecurringTasks(date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
    },
    onError: (error: Error) => {
      console.error('Failed to generate recurring tasks:', error.message);
    },
  });
}
