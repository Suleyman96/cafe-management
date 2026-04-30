import type { CustomerFeedback } from '@gustri/database';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '../keys';
import { useDb } from '../provider';

export function useFeedback(status?: CustomerFeedback['status']) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.FEEDBACK, status],
    queryFn: () =>
      db.feedback.findAll(status ? { status } : undefined) as Promise<CustomerFeedback[]>,
    placeholderData: keepPreviousData,
  });
}

export function usePendingFeedbackCount() {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.FEEDBACK, 'pending_count'],
    queryFn: () => db.feedback.getPendingCount() as Promise<number>,
  });
}
