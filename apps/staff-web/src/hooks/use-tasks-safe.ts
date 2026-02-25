/**
 * Type-Safe Tasks Hooks
 */

import { QUERY_KEYS } from '@cafe-idare/core';
import type { Database } from '@cafe-idare/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';

type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
type Task = Database['public']['Tables']['tasks']['Row'];

export function useTasks(options?: {
  status?: string;
  priority?: string;
  assignedTo?: string;
  dueBefore?: string;
  isTemplate?: boolean;
}) {
  return useQuery({
    queryKey: [QUERY_KEYS.TASKS, options],
    queryFn: () => db.tasks.findAll(options),
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.TASK, id],
    queryFn: () => db.tasks.findById(id),
    enabled: !!id,
  });
}

export function useMyTasks(staffId: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.TASKS, 'my', staffId],
    queryFn: () => db.tasks.findMyTasks(staffId),
    enabled: !!staffId,
  });
}

export function useTodaysTasks() {
  return useQuery({
    queryKey: [QUERY_KEYS.TASKS, 'today'],
    queryFn: () => db.tasks.getTodaysTasks(),
  });
}

export function useOverdueTasksCount() {
  return useQuery({
    queryKey: [QUERY_KEYS.OVERDUE_TASKS_COUNT],
    queryFn: () => db.tasks.getOverdueCount(),
  });
}

export function useRecurringTemplates() {
  return useQuery({
    queryKey: [QUERY_KEYS.TASKS, 'templates'],
    queryFn: () => db.tasks.getRecurringTemplates(),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TaskInsert) => db.tasks.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.OVERDUE_TASKS_COUNT] });
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.TASKS] });
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.OVERDUE_TASKS_COUNT] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Task> }) =>
      db.tasks.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.OVERDUE_TASKS_COUNT] });
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.TASKS] });
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.OVERDUE_TASKS_COUNT] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.tasks.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.OVERDUE_TASKS_COUNT] });
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.TASKS] });
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.OVERDUE_TASKS_COUNT] });
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
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.TASKS] });
    },
  });
}

export function useMarkTaskCompleted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.tasks.markCompleted(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.OVERDUE_TASKS_COUNT] });
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.TASKS] });
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.OVERDUE_TASKS_COUNT] });
    },
  });
}

export function useMarkTaskCancelled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.tasks.markCancelled(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.OVERDUE_TASKS_COUNT] });
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.TASKS] });
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.OVERDUE_TASKS_COUNT] });
    },
  });
}

export function useGenerateRecurringTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (date: string) => db.tasks.generateRecurringTasks(date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TASKS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.OVERDUE_TASKS_COUNT] });
    },
  });
}
