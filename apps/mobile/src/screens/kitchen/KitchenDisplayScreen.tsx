import { isDeliveryOrder } from '@gustri/core';
import { ORDER_STATUS } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KitchenOrderCard } from '@/components/kitchen/KitchenOrderCard';
import { LoadingScreen } from '@/components/ui';
import { useOrders, useUpdateOrderItemStatus, useUpdateOrderStatus } from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';
import { BRAND_PRIMARY, COLORS, TYPOGRAPHY } from '@/theme';

const KITCHEN_STATUSES = [ORDER_STATUS.NEW, ORDER_STATUS.PREPARING, ORDER_STATUS.READY];

export default function KitchenDisplayScreen() {
  const { t } = useTranslation('staff');
  const insets = useSafeAreaInsets();
  const { data: orders, isLoading, refetch } = useOrders({ statuses: KITCHEN_STATUSES });
  const updateOrderStatus = useUpdateOrderStatus();
  const updateItemStatus = useUpdateOrderItemStatus();
  const { showSuccess, showError } = useSnackbar();
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  const kitchenOrders = useMemo(() => {
    if (!orders) return [];

    return orders
      .filter((o) => KITCHEN_STATUSES.includes(o.status as (typeof KITCHEN_STATUSES)[number]))
      .sort((a, b) => {
        const priority: Record<string, number> = {
          [ORDER_STATUS.NEW]: 0,
          [ORDER_STATUS.PREPARING]: 1,
          [ORDER_STATUS.READY]: 2,
        };
        const pDiff = (priority[a.status] ?? 3) - (priority[b.status] ?? 3);
        if (pDiff !== 0) return pDiff;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
  }, [orders]);

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

        const items = order.order_items || [];
        const pendingItems = items.filter((i) => i.status === 'pending');
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

        const items = order.order_items || [];
        const qualifyingItems = items.filter(
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

        if (succeeded < total && succeeded > 0) {
          showError(t('kitchen.partialItemError', { succeeded, total }));
        }

        await updateOrderStatus.mutateAsync({ orderId, status: 'ready' });
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

        const items = order.order_items || [];
        const qualifyingItems = items.filter(
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

        if (succeeded < total && succeeded > 0) {
          showError(t('kitchen.partialItemError', { succeeded, total }));
        }

        if (!isDeliveryOrder(order)) {
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

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LoadingScreen message={t('kitchen.loadingOrders')} />
      </View>
    );
  }

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

      <FlashList
        data={kitchenOrders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor="#fff" />}
        renderItem={({ item }) => (
          <KitchenOrderCard
            order={item}
            onStartPreparing={handleStartPreparing}
            onMarkItemReady={handleMarkItemReady}
            onMarkAllReady={handleMarkAllReady}
            onMarkAllServed={handleMarkAllServed}
            isProcessing={processingOrderId === item.id}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('kitchen.noActiveOrders')}</Text>
            <Text style={styles.emptySubtext}>{t('kitchen.waitingForOrders')}</Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />
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
