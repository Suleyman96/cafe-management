import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Chip } from 'react-native-paper';
import { DeliveryOrderCard } from '@/components/delivery/DeliveryOrderCard';
import { EmptyState, ErrorScreen, LoadingScreen } from '@/components/ui';
import {
  useCancelOrder,
  useDeliveryOrders,
  useMarkDelivered,
  useMarkOutForDelivery,
  useUpdateOrderStatus,
} from '@/hooks';
import { useCafeSettings } from '@/hooks/use-cafe-settings';
import { useSnackbar } from '@/hooks/use-snackbar';
import { useAuthStore } from '@/store/auth-store';

const STATUS_FILTERS = [
  'all',
  'pending_approval',
  'new',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
];

export default function DeliveryListScreen() {
  const staff = useAuthStore((s) => s.staff);
  const { showSuccess, showError } = useSnackbar();
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: orders, isLoading, error, refetch } = useDeliveryOrders();
  const { data: settings } = useCafeSettings();
  const updateOrderStatus = useUpdateOrderStatus();
  const markOutForDelivery = useMarkOutForDelivery();
  const markDelivered = useMarkDelivered();
  const cancelOrder = useCancelOrder();

  const currencySymbol = settings?.currency_symbol || '$';

  const filtered = useMemo(() => {
    if (!orders) return [];
    if (statusFilter === 'all') return orders;
    return orders.filter((o: { status: string }) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const handleApprove = async (orderId: string) => {
    try {
      await updateOrderStatus.mutateAsync({ orderId, status: 'new' });
      showSuccess('Order approved');
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleStartPreparing = async (orderId: string) => {
    try {
      await updateOrderStatus.mutateAsync({ orderId, status: 'preparing' });
      showSuccess('Preparing started');
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to start preparing');
    }
  };

  const handleMarkReady = async (orderId: string) => {
    try {
      await updateOrderStatus.mutateAsync({ orderId, status: 'ready' });
      showSuccess('Order marked ready');
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to mark ready');
    }
  };

  const handleSendOut = async (orderId: string) => {
    try {
      await markOutForDelivery.mutateAsync({ orderId, deliveryPersonId: staff?.id || '' });
      showSuccess('Order sent out for delivery');
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to send out');
    }
  };

  const handleMarkDelivered = async (orderId: string) => {
    try {
      await markDelivered.mutateAsync(orderId);
      showSuccess('Order delivered');
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to mark delivered');
    }
  };

  const handleCancel = async (orderId: string) => {
    try {
      await cancelOrder.mutateAsync({ orderId, reason: 'Cancelled from mobile app' });
      showSuccess('Order cancelled');
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to cancel');
    }
  };

  if (isLoading) return <LoadingScreen message="Loading delivery orders..." />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((s) => (
          <Chip
            key={s}
            compact
            selected={statusFilter === s}
            onPress={() => setStatusFilter(s)}
            style={styles.filterChip}
          >
            {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
          </Chip>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <DeliveryOrderCard
            order={item}
            currencySymbol={currencySymbol}
            onApprove={handleApprove}
            onStartPreparing={handleStartPreparing}
            onMarkReady={handleMarkReady}
            onSendOut={handleSendOut}
            onMarkDelivered={handleMarkDelivered}
            onCancel={handleCancel}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="moped"
            title="No delivery orders"
            description="Delivery orders will appear here"
          />
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  filterChip: {},
  list: { paddingTop: 4, paddingBottom: 24 },
});
