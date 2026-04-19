import { QUERY_KEYS } from '@gustri/core';
import type { CustomerFeedback } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { useDb } from '../provider';

export function useFeedback(status?: CustomerFeedback['status']) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.FEEDBACK, status],
    queryFn: () => db.feedback.findAll(status) as Promise<CustomerFeedback[]>,
  });
}

export function usePendingFeedbackCount() {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.FEEDBACK, 'pending_count'],
    queryFn: () => db.feedback.getPendingCount() as Promise<number>,
  });
}
