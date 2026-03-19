import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';

export function useTodaysTasks() {
  return useQuery({
    queryKey: ['tasks', 'today'],
    queryFn: () => db.tasks.getTodaysTasks(),
  });
}

export function useTasks(options?: { status?: string; priority?: string; isTemplate?: boolean }) {
  return useQuery({
    queryKey: ['tasks', options],
    queryFn: () => db.tasks.findAll(options as any),
  });
}

export function useMyTasks(staffId: string | undefined) {
  return useQuery({
    queryKey: ['tasks', 'my', staffId],
    queryFn: () => db.tasks.findMyTasks(staffId!),
    enabled: !!staffId,
  });
}

export function useOverdueTasksCount() {
  return useQuery({
    queryKey: ['tasks', 'overdue-count'],
    queryFn: () => db.tasks.getOverdueCount(),
  });
}

export function useRecurringTemplates() {
  return useQuery({
    queryKey: ['tasks', 'recurring'],
    queryFn: () => db.tasks.getRecurringTemplates(),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => db.tasks.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.tasks.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useMarkTaskInProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.tasks.markInProgress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useMarkTaskCompleted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.tasks.markCompleted(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useMarkTaskCancelled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.tasks.markCancelled(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useGenerateRecurringTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (date: string) => db.tasks.generateRecurringTasks(date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
