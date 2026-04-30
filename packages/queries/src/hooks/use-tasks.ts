import type { Task } from '@gustri/database';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '../keys';
import { useDb } from '../provider';

export function useTasks(options?: Record<string, unknown> & { enabled?: boolean }) {
  const db = useDb();
  const { enabled, ...filters } = options ?? {};
  const filterKey = Object.keys(filters).length > 0 ? filters : undefined;
  return useQuery({
    queryKey: [QUERY_KEYS.TASKS, filterKey],
    queryFn: () => db.tasks.findAll(filterKey) as Promise<Task[]>,
    placeholderData: keepPreviousData,
    enabled: enabled ?? true,
  });
}

export function useTask(id: string, options?: { enabled?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.TASK, id],
    queryFn: () => db.tasks.findById(id) as Promise<Task>,
    enabled: !!id && (options?.enabled ?? true),
  });
}

export function useMyTasks(staffId: string, options?: { enabled?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.TASKS, 'my', staffId],
    queryFn: () => db.tasks.findMyTasks(staffId) as Promise<Task[]>,
    enabled: !!staffId && (options?.enabled ?? true),
  });
}

export function useTodaysTasks(options?: { enabled?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.TASKS, 'today'],
    queryFn: () => db.tasks.getTodaysTasks() as Promise<Task[]>,
    enabled: options?.enabled ?? true,
  });
}

export function useOverdueTasksCount(options?: { enabled?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.OVERDUE_TASKS_COUNT],
    queryFn: () => db.tasks.getOverdueCount() as Promise<number>,
    enabled: options?.enabled ?? true,
  });
}

export function useOpenTasksCount(options?: { enabled?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.OPEN_TASKS_COUNT],
    queryFn: () => db.tasks.getOpenTasksCount() as Promise<number>,
    enabled: options?.enabled ?? true,
  });
}

export function useRecurringTemplates(options?: { enabled?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.TASKS, 'recurring'],
    queryFn: () => db.tasks.getRecurringTemplates() as Promise<Task[]>,
    enabled: options?.enabled ?? true,
  });
}
