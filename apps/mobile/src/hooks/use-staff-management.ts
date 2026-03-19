import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';

export function useStaff(role?: string) {
  return useQuery({
    queryKey: ['staff', role],
    queryFn: () => db.staff.findAll(role as any),
  });
}

export function useStaffMember(id: string | undefined) {
  return useQuery({
    queryKey: ['staff-member', id],
    queryFn: () => db.staff.findById(id!),
    enabled: !!id,
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => db.staff.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff-member'] });
    },
  });
}

export function usePaymentsByStaff(staffId: string | undefined, limit?: number) {
  return useQuery({
    queryKey: ['payments-by-staff', staffId],
    queryFn: () => db.payments.findByReceivedBy(staffId!, limit),
    enabled: !!staffId,
  });
}

export function useMySchedule(staffId: string | undefined, startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['my-schedule', staffId, startDate, endDate],
    queryFn: () => db.schedules.findByStaffRange(staffId!, startDate, endDate),
    enabled: !!staffId,
  });
}
