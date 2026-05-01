import type { OrderPayment } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '../keys';
import { useDb } from '../provider';

export function useOrderPayments(orderId: string, options?: { enabled?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.PAYMENTS, orderId],
    queryFn: () =>
      db.payments.findByOrderId(orderId) as Promise<unknown> as Promise<OrderPayment[]>,
    enabled: !!orderId && (options?.enabled ?? true),
  });
}

export function usePaymentsByStaff(
  staffId: string,
  limit?: number,
  options?: { enabled?: boolean },
) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.PAYMENTS_BY_STAFF, staffId, limit],
    queryFn: () =>
      db.payments.findByReceivedBy(staffId, limit) as Promise<unknown> as Promise<OrderPayment[]>,
    enabled: !!staffId && (options?.enabled ?? true),
  });
}

export function useOrderRemainingBalance(orderId: string, options?: { enabled?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.PAYMENTS, orderId, 'balance'],
    queryFn: () => db.rpc.getRemainingBalance(orderId) as Promise<number>,
    enabled: !!orderId && (options?.enabled ?? true),
  });
}
