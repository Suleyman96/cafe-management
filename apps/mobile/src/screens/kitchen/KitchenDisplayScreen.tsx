import { isDeliveryOrder } from '@gustri/core';
import { ORDER_STATUS, type OrderItemStatus } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import {
  deriveKitchenView,
  type KitchenOrderView,
  QUERY_KEYS,
  useStaffKitchenFilters,
} from '@gustri/queries';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KitchenFilterBar } from '@/components/kitchen/KitchenFilterBar';
import { KitchenFilterSheet } from '@/components/kitchen/KitchenFilterSheet';
import { KitchenOrderCard } from '@/components/kitchen/KitchenOrderCard';
import { ErrorScreen, LoadingScreen } from '@/components/ui';
import {
  useCategories,
  useOrders,
  useUpdateOrderItemStatus,
  useUpdateOrderStatus,
} from '@/hooks/local';
import { useFeatureFlag } from '@/hooks/shared';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { useSnackbar } from '@/hooks/use-snackbar';
import { useAuthStore } from '@/store/auth-store';
import { BRAND_PRIMARY, COLORS, TYPOGRAPHY } from '@/theme';

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

export default function KitchenDisplayScreen() {
  const { t } = useTranslation('staff');
  const insets = useSafeAreaInsets();
  const rawStaffId = useAuthStore((s) => s.staff?.id ?? null);
  // Per-tenant kill switch. Default false ⇒ pre-feature behavior. With
  // staffId=null, useStaffKitchenFilters is disabled, deriveKitchenView
  // resolves to "show all", FilterBar/Sheet stay un-rendered, and the
  // bulk handlers reduce to their original semantics. Removing this flag
  // (target: 2 weeks post-enable per CLAUDE.md) is a 3-line edit.
  const filteringEnabled = useFeatureFlag('kitchen_category_filters');
  const staffId = filteringEnabled ? rawStaffId : null;
  // Use the local `useOrders` (with realtime + sound + degraded-poll
  // catchup) and compose the category filter on top via the shared pure
  // `deriveKitchenView`. Calling the *shared* `useKitchenView` would lose
  // mobile's realtime side effects because that hook reaches for the
  // shared `useOrders`.
  const {
    data: orders,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useOrders({ statuses: KITCHEN_STATUSES, limit: 100 });
  const { data: filterCategoryIds, isLoading: filtersLoading } = useStaffKitchenFilters(staffId);
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const updateOrderStatus = useUpdateOrderStatus();
  const updateItemStatus = useUpdateOrderItemStatus();
  const { showSuccess, showError } = useSnackbar();
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);

  // Derive view first (filters by category), then apply the kitchen-status
  // sort + filter. visibleOrders preserves the original shape so all the
  // existing card/handler code keeps working.
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

        // Bulk-advance only this station's items. Without this, the Pizza
        // station's "Start preparing" tap would also flip Bar's drinks to
        // "preparing" — bad cross-station UX.
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
        // starts work — matches the existing semantics. Pre-filter mode
        // assumed all items were ours; per-station, advancing the order
        // when *any* station starts is still correct.
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
        // station is at/past 'ready'. Otherwise marking the order ready
        // while another station is still cooking would mislead waiters.
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

  const renderKitchenOrder = useCallback<ListRenderItem<(typeof kitchenOrders)[number]>>(
    ({ item }) => (
      <KitchenOrderCard
        // The card renders `order.order_items` — pass the per-station
        // visibleItems so a filtered station only sees what it owns.
        // hiddenCount/hiddenByCategory drive the coordination strip.
        order={{ ...item, order_items: item.visibleItems }}
        hiddenCount={item.hiddenCount}
        hiddenByCategory={item.hiddenByCategory}
        onStartPreparing={handleStartPreparing}
        onMarkItemReady={handleMarkItemReady}
        onMarkAllReady={handleMarkAllReady}
        onMarkAllServed={handleMarkAllServed}
        isProcessing={processingOrderId === item.id}
      />
    ),
    [
      handleStartPreparing,
      handleMarkItemReady,
      handleMarkAllReady,
      handleMarkAllServed,
      processingOrderId,
    ],
  );

  // Realtime: subscribe to staff_kitchen_filters scoped by staff_id so a
  // manager updating another staff's filter doesn't fan out here. The
  // tenant-default filter would over-broadcast.
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

  // Gate the loading screen on all three queries — without this, the
  // first paint shows orders un-filtered (filterCategoryIds undefined =
  // show-all) before the filter rows arrive a beat later, producing a
  // visible flash of the wrong items.
  if (isLoading || filtersLoading || categoriesLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LoadingScreen message={t('kitchen.loadingOrders')} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ErrorScreen error={error} onRetry={refetch} />
      </View>
    );
  }

  const isFiltered = activeFilter.mode === 'filtered';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Status summary pills */}
      <View style={styles.summary}>
        <View style={[styles.summaryPill, { backgroundColor: BRAND_PRIMARY }]}>
          <Text style={styles.summaryText}>
            {counts.new} {t('kitchen.new')}
          </Text>
        </View>
        <View style={[styles.summaryPill, { backgroundColor: COLORS.warning }]}>
          <Text style={styles.summaryText}>
            {counts.preparing} {t('kitchen.preparing')}
          </Text>
        </View>
        <View style={[styles.summaryPill, { backgroundColor: COLORS.success }]}>
          <Text style={styles.summaryText}>
            {counts.ready} {t('kitchen.ready')}
          </Text>
        </View>
      </View>

      {staffId && (
        <KitchenFilterBar activeFilter={activeFilter} onPress={() => setFilterSheetVisible(true)} />
      )}

      <FlashList
        data={kitchenOrders}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#fff" />
        }
        renderItem={renderKitchenOrder}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {isFiltered ? t('kitchen.filter.empty') : t('kitchen.noActiveOrders')}
            </Text>
            <Text style={styles.emptySubtext}>
              {isFiltered ? t('kitchen.filter.emptyHint') : t('kitchen.waitingForOrders')}
            </Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />

      {staffId && (
        <KitchenFilterSheet
          visible={filterSheetVisible}
          onDismiss={() => setFilterSheetVisible(false)}
          staffId={staffId}
          categories={categories}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  summaryPill: {
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  summaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  list: {
    paddingBottom: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    ...TYPOGRAPHY.sectionHeader,
    color: COLORS.textMuted,
  },
  emptySubtext: {
    ...TYPOGRAPHY.body,
    color: '#4b5563',
    marginTop: 4,
  },
});
