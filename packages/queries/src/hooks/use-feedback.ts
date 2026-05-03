import type { CustomerFeedback } from '@gustri/database';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, tenantKey } from '../keys';
import { useDb, useTenantId } from '../provider';

export function useFeedback(status?: CustomerFeedback['status'], options?: { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.FEEDBACK, status),
    queryFn: () =>
      db.feedback.findAll(status ? { status } : undefined) as Promise<CustomerFeedback[]>,
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function usePendingFeedbackCount(options?: { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.FEEDBACK, 'pending_count'),
    queryFn: () => db.feedback.getPendingCount() as Promise<number>,
    enabled: options?.enabled ?? true,
  });
}
