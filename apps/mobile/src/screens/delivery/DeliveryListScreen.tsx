import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ACTIVE_DELIVERY_STATUSES, ORDER_STATUS_KEYS } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, FAB, Portal, Searchbar } from 'react-native-paper';
import { CreateDeliveryModal } from '@/components/delivery/CreateDeliveryModal';
import { DeliveryOrderCard } from '@/components/delivery/DeliveryOrderCard';
import { EmptyState, ErrorScreen, LoadingScreen } from '@/components/ui';
import {
  useCancelOrder,
  useCurrencySymbol,
  useDeliveryOrders,
  useMarkDelivered,
  useMarkOutForDelivery,
  useUpdateOrderStatus,
} from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';
import { Text, TextInput } from '@/lib/paper-compat';
import { useAuthStore } from '@/store/auth-store';

const STATUS_FILTERS = [
  'all',
  'pending_approval',
  'new',
  'preparing',
  'ready',
  'out_for_delivery',
  'delivered',
  'cancelled',
];

export default function DeliveryListScreen() {
  const staff = useAuthStore((s) => s.staff);
  const { showSuccess, showError } = useSnackbar();
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Cancel dialog state
  const [cancelTarget, setCancelTarget] = useState<{
    id: string;
    customer_name?: string | null;
  } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const { data: orders, isLoading, error, refetch } = useDeliveryOrders();
  const updateOrderStatus = useUpdateOrderStatus();
  const markOutForDelivery = useMarkOutForDelivery();
  const markDelivered = useMarkDelivered();
  const cancelOrder = useCancelOrder();

  const currencySymbol = useCurrencySymbol();

  const activeCount = useMemo(() => {
    if (!orders) return 0;
    return orders.filter((o: { status: string }) =>
      (ACTIVE_DELIVERY_STATUSES as readonly string[]).includes(o.status),
    ).length;
  }, [orders]);

  const filtered = useMemo(() => {
    if (!orders) return [];
    let result = orders;

    if (statusFilter !== 'all') {
      result = result.filter((o: { status: string }) => o.status === statusFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (o: {
          id: string;
          customer_name?: string | null;
          delivery_address?: string | null;
          customer_phone?: string | null;
        }) =>
          o.customer_name?.toLowerCase().includes(term) ||
          o.delivery_address?.toLowerCase().includes(term) ||
          o.customer_phone?.includes(term) ||
          o.id.toLowerCase().includes(term),
      );
    }

    return result;
  }, [orders, statusFilter, searchTerm]);

  const handleApprove = async (orderId: string) => {
    try {
      await updateOrderStatus.mutateAsync({ orderId, status: 'new' });
      showSuccess(t('delivery.orderApproved'));
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('delivery.failedApprove'));
    }
  };

  const handleStartPreparing = async (orderId: string) => {
    try {
      await updateOrderStatus.mutateAsync({ orderId, status: 'preparing' });
      showSuccess(t('delivery.preparingStarted'));
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('delivery.failedPrepare'));
    }
  };

  const handleMarkReady = async (orderId: string) => {
    try {
      await updateOrderStatus.mutateAsync({ orderId, status: 'ready' });
      showSuccess(t('delivery.orderMarkedReady'));
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('delivery.failedReady'));
    }
  };

  const handleSendOut = async (orderId: string) => {
    try {
      await markOutForDelivery.mutateAsync({ orderId, deliveryPersonId: staff?.id || '' });
      showSuccess(t('delivery.orderSentOut'));
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('delivery.failedSend'));
    }
  };

  const handleMarkDelivered = async (orderId: string) => {
    try {
      await markDelivered.mutateAsync(orderId);
      showSuccess(t('delivery.orderDelivered'));
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('delivery.failedDelivered'));
    }
  };

  const handleOpenCancel = (orderId: string) => {
    const order = orders?.find((o) => o.id === orderId);
    setCancelTarget({ id: orderId, customer_name: order?.customer_name });
    setCancelReason('');
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;

    setCancelling(true);
    try {
      await cancelOrder.mutateAsync({ orderId: cancelTarget.id, reason: cancelReason.trim() });
      showSuccess(t('orders.orderCancelled'));
      setCancelTarget(null);
      setCancelReason('');
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('delivery.failedCancel'));
    } finally {
      setCancelling(false);
    }
  };

  if (isLoading) return <LoadingScreen message={t('delivery.loadingDelivery')} />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      {/* Active count badge */}
      {activeCount > 0 && (
        <View style={styles.activeCountRow}>
          <MaterialCommunityIcons name="truck-delivery" size={16} color="#7c3aed" />
          <Text variant="bodySmall" style={styles.activeCountText}>
            {activeCount} {t('delivery.activeCount')}
          </Text>
        </View>
      )}

      {/* Search bar */}
      <Searchbar
        placeholder={t('delivery.searchDelivery')}
        value={searchTerm}
        onChangeText={setSearchTerm}
        style={styles.searchbar}
        inputStyle={styles.searchInput}
      />

      {/* Status filter chips */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((s) => (
          <Chip key={s} compact selected={statusFilter === s} onPress={() => setStatusFilter(s)}>
            {s === 'all' ? tCommon('all') : t(ORDER_STATUS_KEYS[s] || s)}
          </Chip>
        ))}
      </View>

      <FlashList
        data={filtered}
        estimatedItemSize={120}
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
            onCancel={handleOpenCancel}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="moped"
            title={t('delivery.noDeliveryOrders')}
            description={
              statusFilter !== 'all' ? t('delivery.noOrdersMatch') : t('delivery.ordersAppear')
            }
          />
        }
        contentContainerStyle={styles.list}
      />

      {/* FAB to create new delivery order */}
      <FAB
        icon="plus"
        label={t('delivery.newDeliveryOrder')}
        onPress={() => setShowCreateModal(true)}
        style={styles.fab}
        color="#fff"
      />

      {/* Create Delivery Modal */}
      <CreateDeliveryModal
        visible={showCreateModal}
        onDismiss={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          refetch();
        }}
      />

      {/* Cancel Reason Dialog */}
      <Portal>
        <Dialog
          visible={!!cancelTarget}
          onDismiss={() => {
            setCancelTarget(null);
            setCancelReason('');
          }}
        >
          <Dialog.Title style={styles.cancelTitle}>
            {t('delivery.cancelDeliveryOrder')}
          </Dialog.Title>
          <Dialog.Content>
            {cancelTarget?.customer_name && (
              <View style={styles.cancelOrderInfo}>
                <Text variant="bodyMedium" style={styles.cancelOrderName}>
                  {cancelTarget.customer_name}
                </Text>
                <Text variant="bodySmall" style={styles.cancelOrderId}>
                  #{cancelTarget.id.slice(0, 8)}
                </Text>
              </View>
            )}
            <Text variant="bodySmall" style={styles.cancelHint}>
              {t('delivery.cancelReasonHint')}
            </Text>
            <TextInput
              label={t('delivery.cancellationReasonLabel')}
              value={cancelReason}
              onChangeText={setCancelReason}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.cancelInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setCancelTarget(null);
                setCancelReason('');
              }}
              disabled={cancelling}
            >
              {t('orders.keepOrder')}
            </Button>
            <Button
              mode="contained"
              onPress={handleConfirmCancel}
              disabled={cancelling || !cancelReason.trim()}
              loading={cancelling}
              textColor="#fff"
              style={styles.cancelBtn}
            >
              {t('orders.cancelOrder')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  activeCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  activeCountText: {
    color: '#7c3aed',
    fontWeight: '600',
    fontSize: 13,
  },
  searchbar: {
    marginHorizontal: 16,
    marginTop: 8,
    elevation: 1,
    borderRadius: 8,
  },
  searchInput: { fontSize: 14 },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  list: { paddingTop: 4, paddingBottom: 80 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: '#7c3aed',
  },
  cancelTitle: { color: '#ef4444' },
  cancelOrderInfo: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  cancelOrderName: { fontWeight: '600' },
  cancelOrderId: { color: '#9ca3af', marginTop: 2 },
  cancelHint: { color: '#6b7280', marginBottom: 8 },
  cancelInput: { marginTop: 4 },
  cancelBtn: { backgroundColor: '#ef4444' },
});
