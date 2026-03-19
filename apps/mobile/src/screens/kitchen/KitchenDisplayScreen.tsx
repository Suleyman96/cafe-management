import { useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Chip, Provider as PaperProvider, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KitchenOrderCard } from '@/components/kitchen/KitchenOrderCard';
import { LoadingScreen } from '@/components/ui';
import { useOrders, useUpdateOrderItemStatus, useUpdateOrderStatus } from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';
import { kitchenDarkTheme } from '@/theme';

const KITCHEN_STATUSES = ['new', 'preparing', 'ready'];

export default function KitchenDisplayScreen() {
  const insets = useSafeAreaInsets();
  const { data: orders, isLoading, refetch } = useOrders();
  const updateOrderStatus = useUpdateOrderStatus();
  const updateItemStatus = useUpdateOrderItemStatus();
  const { showSuccess, showError } = useSnackbar();

  const kitchenOrders = useMemo(() => {
    if (!orders) return [];

    return orders
      .filter((o) => KITCHEN_STATUSES.includes(o.status))
      .sort((a, b) => {
        const priority: Record<string, number> = { new: 0, preparing: 1, ready: 2 };
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

  const handleStartPreparing = async (orderId: string) => {
    try {
      await updateOrderStatus.mutateAsync({ orderId, status: 'preparing' });
      showSuccess('Order started');
    } catch (err: any) {
      showError(err?.message || 'Failed to start order');
    }
  };

  const handleMarkItemReady = async (itemId: string) => {
    try {
      await updateItemStatus.mutateAsync({ itemId, status: 'ready' });
    } catch (err: any) {
      showError(err?.message || 'Failed to update item');
    }
  };

  const handleMarkAllReady = async (orderId: string) => {
    try {
      await updateOrderStatus.mutateAsync({ orderId, status: 'ready' });
      showSuccess('Order ready');
    } catch (err: any) {
      showError(err?.message || 'Failed to mark ready');
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LoadingScreen message="Loading orders..." />
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
            style={[styles.summaryChip, { backgroundColor: '#3b82f6' }]}
            textStyle={styles.summaryText}
          >
            {counts.new} New
          </Chip>
          <Chip
            compact
            style={[styles.summaryChip, { backgroundColor: '#f59e0b' }]}
            textStyle={styles.summaryText}
          >
            {counts.preparing} Preparing
          </Chip>
          <Chip
            compact
            style={[styles.summaryChip, { backgroundColor: '#10b981' }]}
            textStyle={styles.summaryText}
          >
            {counts.ready} Ready
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
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text variant="headlineSmall" style={styles.emptyText}>
                No active orders
              </Text>
              <Text variant="bodyMedium" style={styles.emptySubtext}>
                New orders will appear here
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
