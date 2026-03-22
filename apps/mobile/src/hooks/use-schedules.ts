import { QUERY_KEYS } from '@cafe-idare/core';
import type { StaffScheduleInsert, StaffScheduleUpdate } from '@cafe-idare/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';
import type { StaffSchedule } from '@/types';

export function useSchedulesByDateRange(startDate: string, endDate: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.SCHEDULES, startDate, endDate],
    queryFn: async (): Promise<StaffSchedule[]> => db.schedules.findByDateRange(startDate, endDate),
  });
}

export function useSchedulesByDate(date: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.SCHEDULES, 'day', date],
    queryFn: async (): Promise<StaffSchedule[]> => db.schedules.findByDate(date),
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: StaffScheduleInsert) => db.schedules.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SCHEDULES] });
    },
    onError: (error: Error) => {
      console.error('Failed to create schedule:', error.message);
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: StaffScheduleUpdate }) =>
      db.schedules.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SCHEDULES] });
    },
    onError: (error: Error) => {
      console.error('Failed to update schedule:', error.message);
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.schedules.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SCHEDULES] });
    },
    onError: (error: Error) => {
      console.error('Failed to delete schedule:', error.message);
    },
  });
}

export function useMarkScheduleInProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, actualStart }: { id: string; actualStart: string }) =>
      db.schedules.markInProgress(id, actualStart),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SCHEDULES] });
    },
    onError: (error: Error) => {
      console.error('Failed to mark schedule in progress:', error.message);
    },
  });
}

export function useMarkScheduleCompleted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, actualEnd }: { id: string; actualEnd?: string }) =>
      db.schedules.markCompleted(id, actualEnd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SCHEDULES] });
    },
    onError: (error: Error) => {
      console.error('Failed to mark schedule completed:', error.message);
    },
  });
}
