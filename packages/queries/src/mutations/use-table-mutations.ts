import type { Table, TablesInsert, TablesUpdate } from '@gustri/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '../keys';
import { useDb } from '../provider';
import type { MutationCallbacks } from './types';

export function useUpdateTableStatus(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Table['status'] }) =>
      db.tables.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
    },
    onError: options?.onError,
  });
}

export function useCreateTable(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TablesInsert) => db.tables.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
    },
    onError: options?.onError,
  });
}

export function useUpdateTable(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: TablesUpdate }) =>
      db.tables.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
    },
    onError: options?.onError,
  });
}

export function useDeleteTable(options?: MutationCallbacks) {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.tables.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
    },
    onError: options?.onError,
  });
}
