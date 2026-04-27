/**
 * Type-Safe Tasks Hooks
 * Re-exports from @gustri/queries, with local composite hook
 */

import { useMyTasks as useMyTasksShared } from '@gustri/queries';

// Re-export shared hooks
export {
  useCreateTask,
  useDeleteTask,
  useGenerateRecurringTasks,
  useMarkTaskCancelled,
  useMarkTaskCompleted,
  useMarkTaskInProgress,
  useMyTasks,
  useOpenTasksCount,
  useOverdueTasksCount,
  useRecurringTemplates,
  useTask,
  useTasks,
  useTodaysTasks,
  useUpdateTask,
} from '@gustri/queries';

// Composite hook: derives open task count for a specific staff member
export function useMyOpenTasksCount(staffId: string) {
  const { data: myTasks } = useMyTasksShared(staffId);
  return (myTasks || []).filter(
    (task) => task.status === 'pending' || task.status === 'in_progress',
  ).length;
}
