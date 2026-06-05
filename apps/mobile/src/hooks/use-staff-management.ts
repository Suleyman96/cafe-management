import type { StaffUpdate } from '@gustri/database/types';
import { QUERY_KEYS, useDb } from '@gustri/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MUTATION_KEYS } from '@/lib/mutation-keys';

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
    mutationKey: MUTATION_KEYS.UPDATE_STAFF,
    mutationFn: ({ id, data }: { id: string; data: StaffUpdate }) => db.staff.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STAFF] });
    },
  });
}
