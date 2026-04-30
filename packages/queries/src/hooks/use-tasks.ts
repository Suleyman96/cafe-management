import type { Task } from '@gustri/database';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '../keys';
import { useDb } from '../provider';

export function useTasks(options?: Record<string, unknown>) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.TASKS, options],
    queryFn: () => db.tasks.findAll(options) as Promise<Task[]>,
    placeholderData: keepPreviousData,
  });
}

export function useTask(id: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.TASK, id],
    queryFn: () => db.tasks.findById(id) as Promise<Task>,
    enabled: !!id,
  });
}

export function useMyTasks(staffId: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.TASKS, 'my', staffId],
    queryFn: () => db.tasks.findMyTasks(staffId) as Promise<Task[]>,
    enabled: !!staffId,
  });
}

export function useTodaysTasks() {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.TASKS, 'today'],
    queryFn: () => db.tasks.getTodaysTasks() as Promise<Task[]>,
  });
}

export function useOverdueTasksCount() {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.OVERDUE_TASKS_COUNT],
    queryFn: () => db.tasks.getOverdueCount() as Promise<number>,
  });
}

export function useOpenTasksCount() {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.OPEN_TASKS_COUNT],
    queryFn: () => db.tasks.getOpenTasksCount() as Promise<number>,
  });
}

export function useRecurringTemplates() {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.TASKS, 'recurring'],
    queryFn: () => db.tasks.getRecurringTemplates() as Promise<Task[]>,
  });
}
