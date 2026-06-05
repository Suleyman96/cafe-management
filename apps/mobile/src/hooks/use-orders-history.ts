import type { Order, OrderWithDetails } from '@gustri/database/types';
import { QUERY_KEYS, useDb } from '@gustri/queries';
import { useInfiniteQuery } from '@tanstack/react-query';

const PAGE_SIZE = 50;

export type OrderHistoryFilters = {
  status?: Order['status'];
  statuses?: Order['status'][];
  table_id?: string;
  assigned_waiter_id?: string;
  created_after?: string;
  created_before?: string;
  order_type?: Order['order_type'];
};

/**
 * Paginated history hook backed by `useInfiniteQuery`. Use this whenever a
 * screen renders a list that can grow beyond a few hundred rows — the
 * standard `useOrders` hook caps each fetch and is meant for active queues.
 *
 * Usage with `<FlashList>`:
 *   const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
 *     useOrdersHistory({ created_after: weekAgoIso });
 *   const orders = useMemo(() => data?.pages.flat() ?? [], [data]);
 *   <FlashList data={orders} onEndReached={() => hasNextPage && fetchNextPage()} ... />
 */
export function useOrdersHistory(filters: OrderHistoryFilters) {
  const db = useDb();

  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.ORDERS, 'history', filters],
    queryFn: ({ pageParam }): Promise<OrderWithDetails[]> =>
      db.orders.findAll({
        ...filters,
        limit: PAGE_SIZE,
        offset: pageParam,
      }) as Promise<OrderWithDetails[]>,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
  });
}
