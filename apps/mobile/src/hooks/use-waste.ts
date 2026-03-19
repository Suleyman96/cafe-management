import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';

export function useWasteLogs(options?: { startDate?: string; endDate?: string; reason?: string }) {
  return useQuery({
    queryKey: ['waste-logs', options],
    queryFn: () => db.waste.findAll(options),
  });
}

export function useWasteMonthlySummary(year: number, month: number) {
  return useQuery({
    queryKey: ['waste-summary', year, month],
    queryFn: () => db.waste.getMonthlySummary(year, month),
  });
}

export function useCreateWasteLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => db.waste.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waste-logs'] });
      queryClient.invalidateQueries({ queryKey: ['waste-summary'] });
    },
  });
}

export function useDeleteWasteLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.waste.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waste-logs'] });
      queryClient.invalidateQueries({ queryKey: ['waste-summary'] });
    },
  });
}
