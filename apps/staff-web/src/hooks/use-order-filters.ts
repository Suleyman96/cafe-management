import type { OrderWithDetails } from '@gustri/database';
import { useMemo, useState } from 'react';

interface UseOrderFiltersOptions {
  orders: OrderWithDetails[] | undefined;
  /** Additional search fields beyond id + customer_name (page-specific). */
  searchFields?: (order: OrderWithDetails, query: string) => boolean;
  /** Statuses considered "active" for the activeCount metric. */
  activeStatuses?: string[];
}

interface UseOrderFiltersReturn<TStatus extends string> {
  filteredOrders: OrderWithDetails[] | undefined;
  statusFilter: TStatus | 'all';
  setStatusFilter: (status: TStatus | 'all') => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  activeCount: number;
}

/**
 * Shared order filtering logic used across orders, takeout, and delivery pages.
 * Handles status filtering, text search, and active order counting.
 */
export function useOrderFilters<TStatus extends string>({
  orders,
  searchFields,
  activeStatuses,
}: UseOrderFiltersOptions): UseOrderFiltersReturn<TStatus> {
  const [statusFilter, setStatusFilter] = useState<TStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOrders = useMemo(() => {
    return orders?.filter((order) => {
      // Status filter
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;

      // Text search
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchesBase =
          order.id.toLowerCase().includes(q) || order.customer_name?.toLowerCase().includes(q);

        const matchesExtra = searchFields?.(order, q) ?? false;

        if (!matchesBase && !matchesExtra) return false;
      }

      return true;
    });
  }, [orders, statusFilter, searchTerm, searchFields]);

  const activeCount = useMemo(() => {
    if (!activeStatuses || !orders) return 0;
    return orders.filter((o) => activeStatuses.includes(o.status)).length;
  }, [orders, activeStatuses]);

  return {
    filteredOrders,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    activeCount,
  };
}
