import { ORDER_STATUS } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Chip, Provider as PaperProvider, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KitchenOrderCard } from '@/components/kitchen/KitchenOrderCard';
import { LoadingScreen } from '@/components/ui';
import { useOrders, useUpdateOrderItemStatus, useUpdateOrderStatus } from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';
import { kitchenDarkTheme } from '@/theme';

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
        const order = kitchenOrders.find((o) => o.id === orderId);
        if (!order) return;

        const items = order.order_items || [];
        let succeeded = 0;
        const total = items.filter((i: any) => i.status === 'pending').length;

        for (const item of items) {
          if ((item as any).status === 'pending') {
            await updateItemStatus.mutateAsync({
              itemId: (item as any).id,
              status: 'preparing',
            });
            succeeded++;
          }
        }

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
    [kitchenOrders, updateItemStatus, updateOrderStatus, showSuccess, showError, t],
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
        const order = kitchenOrders.find((o) => o.id === orderId);
        if (!order) return;

        const items = order.order_items || [];
        let succeeded = 0;
        const total = items.filter(
          (i: any) => i.status === 'pending' || i.status === 'preparing',
        ).length;

        for (const item of items) {
          const s = (item as any).status;
          if (s === 'pending' || s === 'preparing') {
            await updateItemStatus.mutateAsync({ itemId: (item as any).id, status: 'ready' });
            succeeded++;
          }
        }

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
    [kitchenOrders, updateItemStatus, updateOrderStatus, showSuccess, showError, t],
  );

  const handleMarkAllServed = useCallback(
    async (orderId: string) => {
      setProcessingOrderId(orderId);
      try {
        const order = kitchenOrders.find((o) => o.id === orderId);
        if (!order) return;

        const items = order.order_items || [];
        let succeeded = 0;
        const total = items.filter(
          (i: any) => i.status !== 'cancelled' && i.status !== 'served',
        ).length;

        for (const item of items) {
          const s = (item as any).status;
          if (s !== 'cancelled' && s !== 'served') {
            await updateItemStatus.mutateAsync({ itemId: (item as any).id, status: 'served' });
            succeeded++;
          }
        }

        if (succeeded < total && succeeded > 0) {
          showError(t('kitchen.partialItemError', { succeeded, total }));
        }

        // Don't set delivery orders to "served" — they use out_for_delivery flow
        if ((order as any).order_type !== 'delivery') {
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
    [kitchenOrders, updateItemStatus, updateOrderStatus, showSuccess, showError, t],
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LoadingScreen message={t('kitchen.loadingOrders')} />
      </View>
    );
  }

  return (
    <PaperProvider theme={kitchenDarkTheme}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Status summary */}
        <View style={styles.summary}>
          <Chip
            compact
            style={[styles.summaryChip, { backgroundColor: '#367B8B' }]}
            textStyle={styles.summaryText}
          >
            {counts.new} {t('kitchen.new')}
          </Chip>
          <Chip
            compact
            style={[styles.summaryChip, { backgroundColor: '#f59e0b' }]}
            textStyle={styles.summaryText}
          >
            {counts.preparing} {t('kitchen.preparing')}
          </Chip>
          <Chip
            compact
            style={[styles.summaryChip, { backgroundColor: '#10b981' }]}
            textStyle={styles.summaryText}
          >
            {counts.ready} {t('kitchen.ready')}
          </Chip>
        </View>

        <FlatList
          data={kitchenOrders}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refetch} tintColor="#fff" />
          }
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
              <Text variant="headlineSmall" style={styles.emptyText}>
                {t('kitchen.noActiveOrders')}
              </Text>
              <Text variant="bodyMedium" style={styles.emptySubtext}>
                {t('kitchen.newOrdersAppearHere')}
              </Text>
            </View>
          }
          contentContainerStyle={styles.list}
        />
      </View>
    </PaperProvider>
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
  summaryChip: {},
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
    color: '#6b7280',
  },
  emptySubtext: {
    color: '#4b5563',
    marginTop: 4,
  },
});
