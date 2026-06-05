import { isDeliveryOrder } from '@gustri/core';
import { ORDER_STATUS, type OrderItemStatus } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import {
  deriveKitchenView,
  type KitchenOrderView,
  QUERY_KEYS,
  useStaffKitchenFilters,
} from '@gustri/queries';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  useCategories,
  useOrders,
  useUpdateOrderItemStatus,
  useUpdateOrderStatus,
} from '@/hooks/local';
import { useCancelOrder, useFeatureFlag } from '@/hooks/shared';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { useSnackbar } from '@/hooks/use-snackbar';
import { useAuthStore } from '@/store/auth-store';

// Item-status progression order for the per-station bulk advance check.
// Mirrors the staff-web helper — duplicated here rather than exported
// from @gustri/core to keep the headless boundary clean.
const ITEM_STATUS_PROGRESS: Record<OrderItemStatus, number> = {
  pending: 0,
  preparing: 1,
  ready: 2,
  served: 3,
  cancelled: -1,
};

function isAtOrPast(actual: OrderItemStatus, target: OrderItemStatus): boolean {
  return ITEM_STATUS_PROGRESS[actual] >= ITEM_STATUS_PROGRESS[target];
}

type KitchenStatus =
  | typeof ORDER_STATUS.NEW
  | typeof ORDER_STATUS.PREPARING
  | typeof ORDER_STATUS.READY;

const KITCHEN_STATUSES: KitchenStatus[] = [
  ORDER_STATUS.NEW,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY,
];

const KITCHEN_STATUS_PRIORITY = {
  [ORDER_STATUS.NEW]: 0,
  [ORDER_STATUS.PREPARING]: 1,
  [ORDER_STATUS.READY]: 2,
} as const satisfies Record<KitchenStatus, number>;

/**
 * Controller for the mobile kitchen display: the category-filtered active
 * queue, status counts, realtime sync, and the per-station bulk-advance
 * handlers (start / mark-ready / mark-served) plus QR approve/reject.
 * Extracted verbatim from KitchenDisplayScreen — behavior unchanged.
 */
export function useKitchenDisplay() {
  const { t } = useTranslation('staff');
  const rawStaffId = useAuthStore((s) => s.staff?.id ?? null);
  // Per-tenant kill switch. Default false ⇒ pre-feature behavior.
  const filteringEnabled = useFeatureFlag('kitchen_category_filters');
  const staffId = filteringEnabled ? rawStaffId : null;
  // Use the local `useOrders` (with realtime + sound + degraded-poll catchup)
  // and compose the category filter on top via the shared pure
  // `deriveKitchenView`.
  const {
    data: orders,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useOrders({ statuses: KITCHEN_STATUSES, limit: 100 });
  // Separate query for pending QR approval orders so we can render them in
  // their own rail above the main list.
  const { data: pendingApprovalOrders = [] } = useOrders({
    statuses: [ORDER_STATUS.PENDING_APPROVAL],
    limit: 20,
  });
  const { data: filterCategoryIds, isLoading: filtersLoading } = useStaffKitchenFilters(staffId);
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const updateOrderStatus = useUpdateOrderStatus();
  const updateItemStatus = useUpdateOrderItemStatus();
  const cancelOrder = useCancelOrder();
  const { showSuccess, showError } = useSnackbar();
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [rejectingOrder, setRejectingOrder] = useState<{
    id: string;
    tableId: string | null;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approvingOrderId, setApprovingOrderId] = useState<string | null>(null);

  // Derive view first (filters by category), then apply the kitchen-status
  // sort + filter. visibleOrders preserves the original shape.
  const { visibleOrders, activeFilter } = useMemo(
    () =>
      deriveKitchenView({
        orders: orders ?? [],
        filterCategoryIds,
        categories,
      }),
    [orders, filterCategoryIds, categories],
  );

  const kitchenOrders = useMemo(() => {
    return visibleOrders
      .filter((o): o is KitchenOrderView & { status: KitchenStatus } =>
        KITCHEN_STATUSES.includes(o.status as KitchenStatus),
      )
      .sort((a, b) => {
        const pDiff = KITCHEN_STATUS_PRIORITY[a.status] - KITCHEN_STATUS_PRIORITY[b.status];
        if (pDiff !== 0) return pDiff;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
  }, [visibleOrders]);

  // Ref keeps callbacks stable — they read latest orders without re-creating
  const kitchenOrdersRef = useRef(kitchenOrders);
  kitchenOrdersRef.current = kitchenOrders;

  const counts = useMemo(() => {
    const c = { new: 0, preparing: 0, ready: 0 };
    kitchenOrders.forEach((o) => {
      if (o.status in c) c[o.status as keyof typeof c]++;
    });
    return c;
  }, [kitchenOrders]);

  const handleStartPreparing = useCallback(
    async (orderId: string) => {
      setProcessingOrderId(orderId);
      try {
        const order = kitchenOrdersRef.current.find((o) => o.id === orderId);
        if (!order) return;

        // Bulk-advance only this station's items.
        const pendingItems = order.visibleItems.filter((i) => i.status === 'pending');
        const total = pendingItems.length;

        const results = await Promise.all(
          pendingItems.map((item) =>
            updateItemStatus
              .mutateAsync({ itemId: item.id, status: 'preparing' })
              .then(() => true)
              .catch(() => false),
          ),
        );
        const succeeded = results.filter(Boolean).length;

        if (succeeded < total && succeeded > 0) {
          showError(t('kitchen.partialItemError', { succeeded, total }));
        }

        // Order-level status moves to 'preparing' as soon as any station
        // starts work — matches the existing semantics.
        await updateOrderStatus.mutateAsync({ orderId, status: 'preparing' });
        showSuccess(t('kitchen.orderStarted'));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t('kitchen.failedStartOrder');
        showError(message);
      } finally {
        setProcessingOrderId(null);
      }
    },
    [updateItemStatus, updateOrderStatus, showSuccess, showError, t],
  );

  const handleMarkItemReady = useCallback(
    async (itemId: string) => {
      try {
        await updateItemStatus.mutateAsync({ itemId, status: 'ready' });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t('kitchen.failedUpdateItem');
        showError(message);
      }
    },
    [updateItemStatus, showError, t],
  );

  const handleMarkAllReady = useCallback(
    async (orderId: string) => {
      setProcessingOrderId(orderId);
      try {
        const order = kitchenOrdersRef.current.find((o) => o.id === orderId);
        if (!order) return;

        const qualifyingItems = order.visibleItems.filter(
          (i) => i.status === 'pending' || i.status === 'preparing',
        );
        const total = qualifyingItems.length;

        const results = await Promise.all(
          qualifyingItems.map((item) =>
            updateItemStatus
              .mutateAsync({ itemId: item.id, status: 'ready' })
              .then(() => true)
              .catch(() => false),
          ),
        );
        const succeeded = results.filter(Boolean).length;
        const advancedIds = new Set(
          qualifyingItems.filter((_, idx) => results[idx]).map((i) => i.id),
        );

        if (succeeded < total && succeeded > 0) {
          showError(t('kitchen.partialItemError', { succeeded, total }));
        }

        // Order-level READY only when EVERY non-cancelled item across every
        // station is at/past 'ready'.
        const wholeOrderReady = order.order_items.every(
          (item) =>
            item.status === 'cancelled' ||
            advancedIds.has(item.id) ||
            isAtOrPast(item.status as OrderItemStatus, 'ready'),
        );
        if (wholeOrderReady) {
          await updateOrderStatus.mutateAsync({ orderId, status: 'ready' });
        }
        showSuccess(t('kitchen.orderReady'));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t('kitchen.failedMarkReady');
        showError(message);
      } finally {
        setProcessingOrderId(null);
      }
    },
    [updateItemStatus, updateOrderStatus, showSuccess, showError, t],
  );

  const handleMarkAllServed = useCallback(
    async (orderId: string) => {
      setProcessingOrderId(orderId);
      try {
        const order = kitchenOrdersRef.current.find((o) => o.id === orderId);
        if (!order) return;

        const qualifyingItems = order.visibleItems.filter(
          (i) => i.status !== 'cancelled' && i.status !== 'served',
        );
        const total = qualifyingItems.length;

        const results = await Promise.all(
          qualifyingItems.map((item) =>
            updateItemStatus
              .mutateAsync({ itemId: item.id, status: 'served' })
              .then(() => true)
              .catch(() => false),
          ),
        );
        const succeeded = results.filter(Boolean).length;
        const advancedIds = new Set(
          qualifyingItems.filter((_, idx) => results[idx]).map((i) => i.id),
        );

        if (succeeded < total && succeeded > 0) {
          showError(t('kitchen.partialItemError', { succeeded, total }));
        }

        const wholeOrderServed = order.order_items.every(
          (item) =>
            item.status === 'cancelled' ||
            advancedIds.has(item.id) ||
            isAtOrPast(item.status as OrderItemStatus, 'served'),
        );
        if (!isDeliveryOrder(order) && wholeOrderServed) {
          await updateOrderStatus.mutateAsync({ orderId, status: 'served' });
        }
        showSuccess(t('kitchen.orderServed'));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t('kitchen.failedMarkServed');
        showError(message);
      } finally {
        setProcessingOrderId(null);
      }
    },
    [updateItemStatus, updateOrderStatus, showSuccess, showError, t],
  );

  const handleApproveOrder = useCallback(
    async (orderId: string) => {
      setApprovingOrderId(orderId);
      try {
        await updateOrderStatus.mutateAsync({ orderId, status: 'new' });
        showSuccess(t('kitchen.orderApproved'));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t('orders.failedUpdateStatus');
        showError(message);
      } finally {
        setApprovingOrderId(null);
      }
    },
    [updateOrderStatus, showSuccess, showError, t],
  );

  const handleRejectOrder = useCallback(async () => {
    if (!rejectingOrder || !rejectReason.trim()) return;
    try {
      await cancelOrder.mutateAsync({
        orderId: rejectingOrder.id,
        reason: rejectReason.trim(),
        tableId: rejectingOrder.tableId,
      });
      showSuccess(t('kitchen.orderRejected'));
      setRejectingOrder(null);
      setRejectReason('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('orders.failedUpdateStatus');
      showError(message);
    }
  }, [cancelOrder, rejectingOrder, rejectReason, showSuccess, showError, t]);

  // Realtime: subscribe to staff_kitchen_filters scoped by staff_id so a
  // manager updating another staff's filter doesn't fan out here.
  useRealtimeSync(
    'kitchen-filter-realtime',
    useMemo(
      () =>
        staffId
          ? [
              {
                table: 'staff_kitchen_filters' as const,
                event: '*' as const,
                queryKeys: [[QUERY_KEYS.STAFF_KITCHEN_FILTERS, staffId]],
                filter: `staff_id=eq.${staffId}`,
              },
            ]
          : [],
      [staffId],
    ),
  );

  return {
    // queue + data
    kitchenOrders,
    pendingApprovalOrders,
    counts,
    activeFilter,
    staffId,
    categories,
    isLoading,
    filtersLoading,
    categoriesLoading,
    error,
    isRefetching,
    refetch,
    // state
    processingOrderId,
    filterSheetVisible,
    setFilterSheetVisible,
    rejectingOrder,
    setRejectingOrder,
    rejectReason,
    setRejectReason,
    approvingOrderId,
    cancelOrder,
    // handlers
    handleStartPreparing,
    handleMarkItemReady,
    handleMarkAllReady,
    handleMarkAllServed,
    handleApproveOrder,
    handleRejectOrder,
  };
}
