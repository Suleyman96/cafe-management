import { QUERY_KEYS } from '@gustri/core';
import type { StaffScheduleUpdate } from '@gustri/database';
import { useDb } from '@gustri/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MUTATION_KEYS } from '@/lib/mutation-keys';

// Re-export hooks and mutations with matching param shapes
export {
  useCreateSchedule,
  useDeleteSchedule,
  useMarkScheduleCompleted,
  useMarkScheduleInProgress,
  useSchedulesByDate,
  useSchedulesByDateRange,
} from '@gustri/queries';

// Local mutation — mobile consumers use { id, data } instead of { id, updates }

export function useUpdateSchedule() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: MUTATION_KEYS.UPDATE_SCHEDULE,
    mutationFn: ({ id, data }: { id: string; data: StaffScheduleUpdate }) =>
      db.schedules.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SCHEDULES] });
    },
  });
}
