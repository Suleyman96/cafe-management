import { QUERY_KEYS } from '@gustri/core';
import type { Table, TablesInsert, TablesUpdate } from '@gustri/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDb } from '../provider';

export function useUpdateTableStatus() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Table['status'] }) =>
      db.tables.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
    },
  });
}

export function useCreateTable() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TablesInsert) => db.tables.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
    },
  });
}

export function useUpdateTable() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: TablesUpdate }) =>
      db.tables.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
    },
  });
}

export function useDeleteTable() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.tables.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
    },
  });
}
