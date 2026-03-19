import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';

export function useOrderPayments(orderId: string) {
  return useQuery({
    queryKey: ['payments', orderId],
    queryFn: async () => {
      return await db.payments.findByOrderId(orderId);
    },
    enabled: !!orderId,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payment: {
      order_id: string;
      amount: number;
      payment_method: 'cash' | 'card' | 'digital';
      received_by?: string;
      notes?: string | null;
    }) => {
      return await db.payments.create(payment as any);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payments', variables.order_id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', variables.order_id] });
    },
  });
}
