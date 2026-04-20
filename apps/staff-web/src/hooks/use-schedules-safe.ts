/**
 * Type-Safe Schedules Hooks
 * Re-exports from @gustri/queries, with local mutations for param shape compatibility
 */

import type { StaffScheduleUpdate } from '@gustri/database';
import { invalidateSchedules, useDb } from '@gustri/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export {
  useCreateSchedule,
  useDeleteSchedule,
  useMySchedule,
  useMyScheduleToday,
  useSchedulesByDate,
  useSchedulesByDateRange,
} from '@gustri/queries';

// Local mutation — staff-web consumers use { id, data } param shape
export function useUpdateSchedule() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: StaffScheduleUpdate }) =>
      db.schedules.update(id, data),
    onSuccess: () => {
      invalidateSchedules(queryClient);
    },
  });
}
