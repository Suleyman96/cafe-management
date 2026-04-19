import { QUERY_KEYS } from '@gustri/core';
import type { StaffInsert, StaffUpdate } from '@gustri/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDb } from '../provider';

export function useCreateStaff() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: StaffInsert) => db.staff.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STAFF] });
    },
  });
}

export function useUpdateStaff() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: StaffUpdate }) =>
      db.staff.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STAFF] });
    },
  });
}

export function useDeleteStaff() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.staff.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STAFF] });
    },
  });
}
