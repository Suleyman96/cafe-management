import type { OrderPayment } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '../keys';
import { useDb } from '../provider';

export function useOrderPayments(orderId: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.PAYMENTS, orderId],
    queryFn: () => db.payments.findByOrderId(orderId) as Promise<OrderPayment[]>,
    enabled: !!orderId,
  });
}

export function usePaymentsByStaff(staffId: string, limit?: number) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.PAYMENTS_BY_STAFF, staffId, limit],
    queryFn: () => db.payments.findByReceivedBy(staffId, limit) as Promise<OrderPayment[]>,
    enabled: !!staffId,
  });
}

export function useOrderRemainingBalance(orderId: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.PAYMENTS, orderId, 'balance'],
    queryFn: () => db.rpc.getRemainingBalance(orderId) as Promise<number>,
    enabled: !!orderId,
  });
}
