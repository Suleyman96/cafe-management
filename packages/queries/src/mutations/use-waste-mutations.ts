import type { WasteLogInsert, WasteLogUpdate } from '@gustri/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateWaste } from '../invalidation';
import { useDb } from '../provider';

export function useCreateWasteLog() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: WasteLogInsert) => db.waste.create(data),
    onSuccess: () => {
      invalidateWaste(queryClient);
    },
  });
}

export function useUpdateWasteLog() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<WasteLogUpdate> }) =>
      db.waste.update(id, updates),
    onSuccess: () => {
      invalidateWaste(queryClient);
    },
  });
}

export function useDeleteWasteLog() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.waste.delete(id),
    onSuccess: () => {
      invalidateWaste(queryClient);
    },
  });
}
