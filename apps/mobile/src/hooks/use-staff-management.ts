import { QUERY_KEYS } from '@gustri/core';
import type { StaffUpdate } from '@gustri/database';
import { useDb } from '@gustri/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// Re-export hooks with matching param shapes
export {
  useMySchedule,
  usePaymentsByStaff,
  useStaff,
  useStaffMember,
} from '@gustri/queries';

// Local mutation — mobile consumers use { id, data } instead of { id, updates }

export function useUpdateStaff() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: StaffUpdate }) => db.staff.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STAFF] });
    },
  });
}
