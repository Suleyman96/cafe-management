import type { StaffScheduleInsert, StaffScheduleUpdate } from '@gustri/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateSchedules } from '../invalidation';
import { useDb } from '../provider';

export function useCreateSchedule() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: StaffScheduleInsert) => db.schedules.create(data),
    onSuccess: () => {
      invalidateSchedules(queryClient);
    },
  });
}

export function useUpdateSchedule() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: StaffScheduleUpdate }) =>
      db.schedules.update(id, updates),
    onSuccess: () => {
      invalidateSchedules(queryClient);
    },
  });
}

export function useDeleteSchedule() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.schedules.delete(id),
    onSuccess: () => {
      invalidateSchedules(queryClient);
    },
  });
}

export function useMarkScheduleInProgress() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, actualStart }: { id: string; actualStart: string }) =>
      db.schedules.markInProgress(id, actualStart),
    onSuccess: () => {
      invalidateSchedules(queryClient);
    },
  });
}

export function useMarkScheduleCompleted() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, actualEnd }: { id: string; actualEnd?: string }) =>
      db.schedules.markCompleted(id, actualEnd),
    onSuccess: () => {
      invalidateSchedules(queryClient);
    },
  });
}
