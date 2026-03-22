/**
 * Type-Safe Schedules Hooks
 * Uses the wrapped client for type safety
 */

import { QUERY_KEYS } from '@cafe-idare/core';
import type { Database } from '@cafe-idare/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateSchedules } from '@/lib/query-helpers';
import { db } from '@/lib/supabase/wrapped-client';

type StaffScheduleInsert = Database['public']['Tables']['staff_schedules']['Insert'];
type StaffScheduleUpdate = Database['public']['Tables']['staff_schedules']['Update'];

export function useSchedulesByDate(date: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.SCHEDULES, date],
    queryFn: () => db.schedules.findByDate(date),
    enabled: !!date,
  });
}

export function useSchedulesByDateRange(startDate: string, endDate: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.SCHEDULES, startDate, endDate],
    queryFn: () => db.schedules.findByDateRange(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });
}

export function useMySchedule(staffId: string, startDate: string, endDate: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.MY_SCHEDULE, staffId, startDate, endDate],
    queryFn: () => db.schedules.findByStaffRange(staffId, startDate, endDate),
    enabled: !!staffId && !!startDate && !!endDate,
  });
}

export function useMyScheduleToday(staffId: string) {
  const today = new Date().toISOString().split('T')[0];
  return useQuery({
    queryKey: [QUERY_KEYS.MY_SCHEDULE, staffId, today],
    queryFn: () => db.schedules.findByStaffAndDate(staffId, today),
    enabled: !!staffId,
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: StaffScheduleInsert) => db.schedules.create(data),
    onSuccess: () => {
      invalidateSchedules(queryClient);
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: StaffScheduleUpdate }) =>
      db.schedules.update(id, data),
    onSuccess: () => {
      invalidateSchedules(queryClient);
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.schedules.delete(id),
    onSuccess: () => {
      invalidateSchedules(queryClient);
    },
  });
}
