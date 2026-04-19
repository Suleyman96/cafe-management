import { QUERY_KEYS } from '@gustri/core';
import type { Table } from '@gustri/database';
import { useDb } from '@gustri/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// Re-export read hooks with matching param shapes
export { useTable, useTables } from '@gustri/queries';

// Local mutation — mobile consumers use { tableId, status } instead of { id, status }

export function useUpdateTableStatus() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tableId, status }: { tableId: string; status: Table['status'] }) =>
      db.tables.updateStatus(tableId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
    },
  });
}
