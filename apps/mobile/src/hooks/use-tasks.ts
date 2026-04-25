// Shared hooks from @gustri/queries
export {
  useCreateTask,
  useDeleteTask,
  useGenerateRecurringTasks,
  useMarkTaskCancelled,
  useMarkTaskCompleted,
  useMarkTaskInProgress,
  useOpenTasksCount,
  useOverdueTasksCount,
  useRecurringTemplates,
  useTasks,
  useTodaysTasks,
  useUpdateTask,
} from '@gustri/queries';

// Local useMyTasks — accepts string | undefined (shared requires string)
import { QUERY_KEYS } from '@gustri/core';
import type { Task } from '@gustri/database';
import { useDb } from '@gustri/queries';
import { useQuery } from '@tanstack/react-query';

export function useMyTasks(staffId: string | undefined) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.TASKS, 'my', staffId],
    queryFn: () => db.tasks.findMyTasks(staffId!) as Promise<Task[]>,
    enabled: !!staffId,
  });
}

// Local composite hook — derives from local useMyTasks
export function useMyOpenTasksCount(staffId: string | undefined) {
  const { data: myTasks } = useMyTasks(staffId);
  return (myTasks || []).filter((t) => t.status === 'pending' || t.status === 'in_progress').length;
}
