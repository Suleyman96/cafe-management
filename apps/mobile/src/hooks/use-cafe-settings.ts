import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';

export function useCafeSettings() {
  return useQuery({
    queryKey: ['cafe-settings'],
    queryFn: () => db.settings.get(),
  });
}

export function useUpdateCafeSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => db.settings.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-settings'] });
    },
  });
}
