import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '@gustri/i18n';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, FAB, Portal, Searchbar } from 'react-native-paper';
import { CreateTakeoutModal } from '@/components/takeout/CreateTakeoutModal';
import { TakeoutOrderCard } from '@/components/takeout/TakeoutOrderCard';
import { EmptyState, ErrorScreen, LoadingScreen } from '@/components/ui';
import { useCancelOrder, useTakeoutOrders, useUpdateOrderStatus } from '@/hooks';
import { useCafeSettings } from '@/hooks/use-cafe-settings';
import { useSnackbar } from '@/hooks/use-snackbar';
import { Text, TextInput } from '@/lib/paper-compat';

const STATUS_FILTERS = [
  'all',
  'pending_approval',
  'new',
  'preparing',
  'ready',
  'closed',
  'cancelled',
];

const STATUS_LABEL_KEYS: Record<string, string> = {
  pending_approval: 'orders.pendingApproval',
  new: 'orders.new',
  preparing: 'orders.preparing',
  ready: 'orders.ready',
  closed: 'orders.closed',
  cancelled: 'orders.cancelled',
};

const ACTIVE_STATUSES = ['pending_approval', 'new', 'preparing', 'ready'];

export default function TakeoutListScreen() {
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

  const { data: orders, isLoading, error, refetch } = useTakeoutOrders();
  const { data: settings } = useCafeSettings();
  const updateOrderStatus = useUpdateOrderStatus();
  const cancelOrder = useCancelOrder();

  const currencySymbol = settings?.currency_symbol || '$';

  const activeCount = useMemo(() => {
    if (!orders) return 0;
    return orders.filter((o: { status: string }) => ACTIVE_STATUSES.includes(o.status)).length;
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
        (o: any) =>
          o.customer_name?.toLowerCase().includes(term) ||
          o.customer_phone?.includes(term) ||
          o.id.toLowerCase().includes(term),
      );
    }

    return result;
  }, [orders, statusFilter, searchTerm]);

  const handleApprove = async (orderId: string) => {
    try {
      await updateOrderStatus.mutateAsync({ orderId, status: 'new' });
      showSuccess(t('takeout.orderApproved'));
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('takeout.failedApprove'));
    }
  };

  const handleStartPreparing = async (orderId: string) => {
    try {
      await updateOrderStatus.mutateAsync({ orderId, status: 'preparing' });
      showSuccess(t('takeout.preparingStarted'));
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('takeout.failedPrepare'));
    }
  };

  const handleMarkReady = async (orderId: string) => {
    try {
      await updateOrderStatus.mutateAsync({ orderId, status: 'ready' });
      showSuccess(t('takeout.orderReadyForPickup'));
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('takeout.failedReady'));
    }
  };

  const handleOpenCancel = (orderId: string) => {
    const order = orders?.find((o: any) => o.id === orderId);
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
      showError(err instanceof Error ? err.message : t('takeout.failedCancel'));
    } finally {
      setCancelling(false);
    }
  };

  if (isLoading) return <LoadingScreen message={t('takeout.loadingTakeout')} />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      {/* Active count badge */}
      {activeCount > 0 && (
        <View style={styles.activeCountRow}>
          <MaterialCommunityIcons name="shopping" size={16} color="#ea580c" />
          <Text variant="bodySmall" style={styles.activeCountText}>
            {activeCount} {t('takeout.activeCount')}
          </Text>
        </View>
      )}

      {/* Search bar */}
      <Searchbar
        placeholder={t('takeout.searchTakeout')}
        value={searchTerm}
        onChangeText={setSearchTerm}
        style={styles.searchbar}
        inputStyle={styles.searchInput}
      />

      {/* Status filter chips */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((s) => (
          <Chip key={s} compact selected={statusFilter === s} onPress={() => setStatusFilter(s)}>
            {s === 'all' ? tCommon('all') : t(STATUS_LABEL_KEYS[s] || s)}
          </Chip>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <TakeoutOrderCard
            order={item}
            currencySymbol={currencySymbol}
            onApprove={handleApprove}
            onStartPreparing={handleStartPreparing}
            onMarkReady={handleMarkReady}
            onCancel={handleOpenCancel}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="shopping"
            title={t('takeout.noTakeoutOrders')}
            description={
              statusFilter !== 'all' ? t('takeout.noOrdersMatch') : t('takeout.ordersAppear')
            }
          />
        }
        contentContainerStyle={styles.list}
      />

      {/* FAB to create new takeout order */}
      <FAB
        icon="plus"
        label={t('takeout.newTakeoutOrder')}
        onPress={() => setShowCreateModal(true)}
        style={styles.fab}
        color="#fff"
      />

      {/* Create Takeout Modal */}
      <CreateTakeoutModal
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
          <Dialog.Title style={styles.cancelTitle}>{t('takeout.cancelTakeoutOrder')}</Dialog.Title>
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
              {t('takeout.cancelReasonHint')}
            </Text>
            <TextInput
              label={t('takeout.cancellationReasonLabel')}
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
    color: '#ea580c',
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
    backgroundColor: '#ea580c',
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
