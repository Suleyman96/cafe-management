import type { StaffScheduleInsert, StaffScheduleUpdate } from '@gustri/database/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateSchedules } from '../invalidation';
import { useDb, useTenantId } from '../provider';
import type { MutationCallbacks } from './types';

export function useCreateSchedule(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: StaffScheduleInsert) => db.schedules.create(data),
    onSuccess: () => {
      invalidateSchedules(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}

export function useUpdateSchedule(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: StaffScheduleUpdate }) =>
      db.schedules.update(id, updates),
    onSuccess: () => {
      invalidateSchedules(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}

export function useDeleteSchedule(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.schedules.delete(id),
    onSuccess: () => {
      invalidateSchedules(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}

export function useMarkScheduleInProgress(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, actualStart }: { id: string; actualStart: string }) =>
      db.schedules.markInProgress(id, actualStart),
    onSuccess: () => {
      invalidateSchedules(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}

export function useMarkScheduleCompleted(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, actualEnd }: { id: string; actualEnd?: string }) =>
      db.schedules.markCompleted(id, actualEnd),
    onSuccess: () => {
      invalidateSchedules(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}
