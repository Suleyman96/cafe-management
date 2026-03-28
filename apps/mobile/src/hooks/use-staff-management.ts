import { QUERY_KEYS } from '@gustri/core';
import type { StaffUpdate } from '@gustri/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';
import type { OrderPayment, Staff, StaffSchedule } from '@/types';

export function useStaff(role?: Staff['role']) {
  return useQuery({
    queryKey: [QUERY_KEYS.STAFF, role],
    queryFn: async (): Promise<Staff[]> => db.staff.findAll(role),
  });
}

export function useStaffMember(id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.STAFF_MEMBER, id],
    queryFn: async (): Promise<Staff> => db.staff.findById(id!),
    enabled: !!id,
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: StaffUpdate }) => db.staff.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STAFF] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STAFF_MEMBER] });
    },
    onError: (error: Error) => {
      console.error('Failed to update staff member:', error.message);
    },
  });
}

export function usePaymentsByStaff(staffId: string | undefined, limit?: number) {
  return useQuery({
    queryKey: [QUERY_KEYS.PAYMENTS_BY_STAFF, staffId],
    queryFn: async (): Promise<OrderPayment[]> => db.payments.findByReceivedBy(staffId!, limit),
    enabled: !!staffId,
  });
}

export function useMySchedule(staffId: string | undefined, startDate: string, endDate: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.MY_SCHEDULE, staffId, startDate, endDate],
    queryFn: async (): Promise<StaffSchedule[]> =>
      db.schedules.findByStaffRange(staffId!, startDate, endDate),
    enabled: !!staffId,
  });
}
