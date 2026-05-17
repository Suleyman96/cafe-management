import { MaterialCommunityIcons } from '@expo/vector-icons';
import { isDeliveryOrder } from '@gustri/core';
import { ORDER_STATUS, type OrderItemStatus } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import {
  deriveKitchenView,
  type KitchenOrderView,
  QUERY_KEYS,
  useStaffKitchenFilters,
} from '@gustri/queries';
import { ErrorScreen, Skeleton } from '@gustri/ui-mobile';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Dialog,
  PaperProvider,
  Portal,
  TextInput,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KitchenFilterBar } from '@/components/kitchen/KitchenFilterBar';
import { KitchenFilterSheet } from '@/components/kitchen/KitchenFilterSheet';
import { KitchenOrderCard } from '@/components/kitchen/KitchenOrderCard';
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
import { BRAND_PRIMARY, COLORS, kitchenDarkTheme, TYPOGRAPHY } from '@/theme';

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
  // Separate query for pending QR approval orders so we can render them in
  // their own rail above the main list, matching the staff-web kitchen
  // layout. Kept distinct from the main `useOrders` call so the QR
  // approval rail's data doesn't get rolled into the kitchen sort.
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
        <KitchenListSkeleton />
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
    // The kitchen route runs under a darker Paper theme so any Paper
    // surfaces (Dialog, TextInput, ActivityIndicator) match the kitchen's
    // dark canvas instead of inheriting the app-wide light theme.
    <PaperProvider theme={kitchenDarkTheme}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Status summary tiles — icon + count + label, mirroring the web
            kitchen header's New / Cooking / Ready stack. Larger than the
            previous pill so the count is readable from across the line. */}
        <View style={styles.summary}>
          <View style={[styles.summaryTile, { backgroundColor: BRAND_PRIMARY }]}>
            <MaterialCommunityIcons name="alert-circle" size={20} color="#fff" />
            <Text style={styles.summaryCount}>{counts.new}</Text>
            <Text style={styles.summaryLabel}>{t('kitchen.newOrders')}</Text>
          </View>
          <View style={[styles.summaryTile, { backgroundColor: COLORS.warning }]}>
            <MaterialCommunityIcons name="chef-hat" size={20} color="#000" />
            <Text style={[styles.summaryCount, { color: '#000' }]}>{counts.preparing}</Text>
            <Text style={[styles.summaryLabel, { color: '#1f2937' }]}>{t('kitchen.cooking')}</Text>
          </View>
          <View style={[styles.summaryTile, { backgroundColor: COLORS.success }]}>
            <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
            <Text style={styles.summaryCount}>{counts.ready}</Text>
            <Text style={styles.summaryLabel}>{t('kitchen.readyLabel')}</Text>
          </View>
        </View>

        {/* Pending QR Orders rail — only renders when there's something to
            approve. Horizontal scroll keeps the rail out of the main grid's
            vertical scroll, and the amber palette + Paper-managed
            ActivityIndicator inside the buttons keep the loading state
            distinct from the kitchen action buttons below. */}
        {pendingApprovalOrders.length > 0 && (
          <View style={styles.pendingRailWrap}>
            <View style={styles.pendingRailHeader}>
              <MaterialCommunityIcons name="cellphone" size={18} color="#fbbf24" />
              <Text style={styles.pendingRailTitle}>
                {t('kitchen.pendingQrOrders')} ({pendingApprovalOrders.length})
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pendingRailContent}
            >
              {pendingApprovalOrders.map((order) => {
                const itemCount =
                  order.order_items?.filter((i) => i.status !== 'cancelled').length || 0;
                const approving = approvingOrderId === order.id;
                return (
                  <View key={order.id} style={styles.pendingCard}>
                    <View style={styles.pendingCardHeader}>
                      <Text style={styles.pendingOrderNumber}>#{order.order_number || '—'}</Text>
                      <View style={styles.qrBadge}>
                        <MaterialCommunityIcons name="qrcode" size={12} color="#000" />
                        <Text style={styles.qrBadgeText}>QR</Text>
                      </View>
                    </View>
                    <Text style={styles.pendingTableLabel}>
                      {order.table?.table_number
                        ? t('kitchen.tableNumber', { number: order.table.table_number })
                        : t('orders.qrOrder')}
                    </Text>
                    <Text style={styles.pendingMeta}>
                      {t('kitchen.itemCount', { count: itemCount })}
                    </Text>
                    <View style={styles.pendingActions}>
                      <Button
                        mode="contained"
                        compact
                        onPress={() => handleApproveOrder(order.id)}
                        disabled={approving}
                        buttonColor={COLORS.success}
                        textColor="#fff"
                        style={styles.pendingActionBtn}
                      >
                        {approving ? (
                          <ActivityIndicator size={14} color="#fff" />
                        ) : (
                          t('approve', { ns: 'common' })
                        )}
                      </Button>
                      <Button
                        mode="contained"
                        compact
                        onPress={() =>
                          setRejectingOrder({ id: order.id, tableId: order.table_id ?? null })
                        }
                        buttonColor={COLORS.danger}
                        textColor="#fff"
                        style={styles.pendingActionBtn}
                      >
                        {t('reject', { ns: 'common' })}
                      </Button>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {staffId && (
          <KitchenFilterBar
            activeFilter={activeFilter}
            onPress={() => setFilterSheetVisible(true)}
          />
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

        {/* Reject reason dialog. Submission requires a non-empty reason
            (matches the web kitchen — kitchens that ad-hoc reject without
            a reason make finance reconciliation harder). */}
        <Portal>
          <Dialog
            visible={!!rejectingOrder}
            onDismiss={() => {
              setRejectingOrder(null);
              setRejectReason('');
            }}
          >
            <Dialog.Title>
              {t('reject', { ns: 'common' })} #{rejectingOrder?.id.slice(-4).toUpperCase()}
            </Dialog.Title>
            <Dialog.Content>
              <Text style={styles.rejectHint}>{t('kitchen.rejectReason')}</Text>
              <TextInput
                mode="outlined"
                multiline
                numberOfLines={3}
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder={t('kitchen.rejectReasonPlaceholder')}
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                onPress={() => {
                  setRejectingOrder(null);
                  setRejectReason('');
                }}
              >
                {t('cancel', { ns: 'common' })}
              </Button>
              <Button
                onPress={handleRejectOrder}
                disabled={!rejectReason.trim() || cancelOrder.isPending}
                loading={cancelOrder.isPending}
                buttonColor={COLORS.danger}
                textColor="#fff"
              >
                {t('reject', { ns: 'common' })}
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </View>
    </PaperProvider>
  );
}

function KitchenListSkeleton() {
  return (
    <View style={skeletonStyles.wrap}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton cards have no identity
          key={i}
          style={skeletonStyles.card}
        >
          <View style={skeletonStyles.headRow}>
            <Skeleton width={120} height={28} style={skeletonStyles.darkBg} />
            <Skeleton width={56} height={20} radius={9999} style={skeletonStyles.darkBg} />
          </View>
          <Skeleton width="80%" height={14} style={skeletonStyles.darkBg} />
          <Skeleton width="65%" height={14} style={skeletonStyles.darkBg} />
          <Skeleton width="100%" height={40} style={skeletonStyles.darkBg} />
        </View>
      ))}
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  wrap: { padding: 12, gap: 10 },
  card: {
    backgroundColor: '#262626',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#374151',
    padding: 14,
    gap: 10,
  },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // The Skeleton's default light gray reads as a black smear on the dark
  // kitchen surface; brighten the band so the pulse stays visible.
  darkBg: { backgroundColor: '#3f3f46' },
});

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
    paddingHorizontal: 12,
  },
  summaryTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 92,
  },
  summaryCount: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 20,
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
    fontSize: 12,
  },
  pendingRailWrap: {
    paddingTop: 4,
    paddingBottom: 12,
  },
  pendingRailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  pendingRailTitle: {
    color: '#fbbf24',
    fontWeight: '700',
    fontSize: 14,
  },
  pendingRailContent: {
    paddingHorizontal: 12,
    gap: 10,
  },
  pendingCard: {
    width: 200,
    borderWidth: 2,
    borderColor: '#f59e0b',
    backgroundColor: '#3b2a05',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  pendingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pendingOrderNumber: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 20,
  },
  qrBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fbbf24',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  qrBadgeText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 10,
  },
  pendingTableLabel: {
    color: '#fcd34d',
    fontWeight: '700',
    fontSize: 13,
  },
  pendingMeta: {
    color: '#d1d5db',
    fontSize: 12,
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  pendingActionBtn: {
    flex: 1,
  },
  rejectHint: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginBottom: 12,
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
