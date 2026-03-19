import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';

export function useSchedulesByDateRange(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['schedules', startDate, endDate],
    queryFn: () => db.schedules.findByDateRange(startDate, endDate),
  });
}

export function useSchedulesByDate(date: string) {
  return useQuery({
    queryKey: ['schedules', 'day', date],
    queryFn: () => db.schedules.findByDate(date),
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => db.schedules.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => db.schedules.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.schedules.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useMarkScheduleInProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, actualStart }: { id: string; actualStart: string }) =>
      db.schedules.markInProgress(id, actualStart),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useMarkScheduleCompleted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, actualEnd }: { id: string; actualEnd?: string }) =>
      db.schedules.markCompleted(id, actualEnd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}
