import { ACTIVE_ORDER_STATUSES } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import {
  ConfirmDialog,
  ErrorScreen,
  LoadingScreen,
  StatusBadge,
  TimeElapsed,
} from '@gustri/ui-mobile';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, FAB, Text } from 'react-native-paper';
import { TransferTableModal } from '@/components/tables/TransferTableModal';
import {
  useCurrencySymbol,
  useOrders,
  useUpdateTableStatus,
  useUpdateWaiterCall,
  useWaiterCalls,
} from '@/hooks/local';
import { useTable } from '@/hooks/shared';
import { useSnackbar } from '@/hooks/use-snackbar';
import { useAuthStore } from '@/store/auth-store';
import { COLORS, TABLE_STATUS_COLORS, WAITER_CALL_REASON_COLORS } from '@/theme';
import type {
  Order,
  OrderItemWithMenuItem,
  Table,
  TablesStackParamList,
  WaiterCall,
} from '@/types';

type Route = RouteProp<TablesStackParamList, 'TableDetail'>;
type Nav = StackNavigationProp<TablesStackParamList, 'TableDetail'>;

// The wrapper's findAll returns joined data beyond the base Order type
type OrderWithJoins = Order & {
  table?: { table_number: string; location: string | null };
  order_items?: OrderItemWithMenuItem[];
  assigned_waiter?: { full_name: string } | null;
};

const TABLE_STATUSES = ['free', 'occupied', 'reserved', 'closed'] as const;

export default function TableDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { tableId } = route.params;
  const staff = useAuthStore((s) => s.staff);
  const { showSuccess, showError } = useSnackbar();
  const { t } = useTranslation('staff');

  const { data: table, isLoading, error, refetch } = useTable(tableId);
  const { data: orders } = useOrders({
    statuses: ACTIVE_ORDER_STATUSES as unknown as Order['status'][],
    table_id: tableId,
    limit: 50,
  });
  const { data: waiterCalls } = useWaiterCalls('pending');
  const currencySymbol = useCurrencySymbol();
  const updateTableStatus = useUpdateTableStatus();
  const updateWaiterCall = useUpdateWaiterCall();

  const [statusConfirm, setStatusConfirm] = useState<Table['status'] | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  const activeOrders = useMemo(
    () =>
      (orders as OrderWithJoins[] | undefined)?.filter(
        (o) =>
          o.table_id === tableId && (ACTIVE_ORDER_STATUSES as readonly string[]).includes(o.status),
      ) || [],
    [orders, tableId],
  );

  const pendingCalls = useMemo(
    () => waiterCalls?.filter((c: Pick<WaiterCall, 'table_id'>) => c.table_id === tableId) || [],
    [waiterCalls, tableId],
  );

  const handleCreateOrder = () => {
    navigation.getParent()?.navigate('OrdersTab', {
      screen: 'AddItems',
      params: { tableId },
    });
  };

  const handleStatusChange = async (newStatus: Table['status']) => {
    try {
      await updateTableStatus.mutateAsync({ tableId, status: newStatus });
      showSuccess(t('tables.statusUpdated', { status: newStatus }));
      setStatusConfirm(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err : t('tables.failedUpdateStatus'));
    }
  };

  const handleRespondCall = async (callId: string) => {
    if (!staff?.id) {
      showError(t('payment.notAuthenticated'));
      return;
    }
    try {
      await updateWaiterCall.mutateAsync({
        callId,
        status: 'acknowledged',
        staffId: staff.id,
      });
      showSuccess(t('calls.callAcknowledged'));
    } catch (err: unknown) {
      showError(err instanceof Error ? err : t('calls.failedRespond'));
    }
  };

  if (isLoading) return <LoadingScreen />;
  if (error || !table)
    return <ErrorScreen error={error || t('tables.tableNotFound')} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      <FlashList
        data={activeOrders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.row}>
                  <Text variant="headlineMedium" style={styles.bold}>
                    {t('tables.tableHash', { number: table.table_number })}
                  </Text>
                  <StatusBadge status={table.status} type="table" />
                </View>
                {table.location && (
                  <Text variant="bodyMedium" style={styles.muted}>
                    {table.location}
                  </Text>
                )}
                {table.capacity && (
                  <Text variant="bodySmall" style={styles.muted}>
                    {t('tables.capacity')}: {table.capacity}
                  </Text>
                )}
                <View style={styles.chipRow}>
                  {TABLE_STATUSES.map((s) => {
                    const chipColors = TABLE_STATUS_COLORS[s];
                    return (
                      <Chip
                        key={s}
                        selected={table.status === s}
                        onPress={() => {
                          if (table.status !== s) setStatusConfirm(s);
                        }}
                        compact
                        style={[
                          styles.statusChip,
                          table.status === s && chipColors && { backgroundColor: chipColors.bg },
                        ]}
                        textStyle={
                          table.status === s && chipColors ? { color: chipColors.text } : undefined
                        }
                      >
                        {t(`tables.${s}`)}
                      </Chip>
                    );
                  })}
                </View>
                {activeOrders.length > 0 && (
                  <Button
                    mode="outlined"
                    icon="swap-horizontal"
                    onPress={() => setTransferOpen(true)}
                    style={styles.transferBtn}
                  >
                    {t('tables.transferTableBtn')}
                  </Button>
                )}
              </Card.Content>
            </Card>

            {pendingCalls.length > 0 && (
              <Card style={[styles.card, styles.callCard]}>
                <Card.Content>
                  <Text variant="titleMedium" style={styles.bold}>
                    {t('calls.title')}
                  </Text>
                  {pendingCalls.map(
                    (call: Pick<WaiterCall, 'id' | 'call_type' | 'reason' | 'created_at'>) => {
                      const callType = call.call_type ?? 'assistance';
                      const chipColor = WAITER_CALL_REASON_COLORS[callType] || COLORS.textMuted;
                      return (
                        <View key={call.id} style={styles.callItem}>
                          <View style={styles.callInfo}>
                            <Chip
                              compact
                              style={[styles.reasonChip, { backgroundColor: `${chipColor}20` }]}
                              textStyle={{ color: chipColor, fontWeight: '600' }}
                            >
                              {t(`calls.${callType}`) || callType.replace(/_/g, ' ')}
                            </Chip>
                            <TimeElapsed createdAt={call.created_at} />
                          </View>
                          <Button
                            compact
                            mode="contained"
                            onPress={() => handleRespondCall(call.id)}
                          >
                            {t('calls.respond')}
                          </Button>
                        </View>
                      );
                    },
                  )}
                </Card.Content>
              </Card>
            )}

            {activeOrders.length > 0 && (
              <Text variant="titleMedium" style={styles.sectionTitle}>
                {t('orders.activeOrders', { count: activeOrders.length })}
              </Text>
            )}
          </View>
        }
        renderItem={({ item: order }) => (
          <Card
            style={styles.orderCard}
            onPress={() => {
              navigation.getParent()?.navigate('OrdersTab', {
                screen: 'OrderDetail',
                params: { orderId: order.id },
              });
            }}
          >
            <Card.Content>
              <View style={styles.row}>
                <Text variant="titleMedium" style={styles.bold}>
                  #{order.order_number || '--'}
                </Text>
                <StatusBadge status={order.status} type="order" />
              </View>
              <View style={styles.row}>
                <Text variant="bodySmall" style={styles.muted}>
                  {t('orders.itemsCount', { count: order.order_items?.length || 0 })}
                </Text>
                <Text variant="bodyMedium" style={styles.bold}>
                  {currencySymbol}
                  {(order.total ?? 0).toFixed(2)}
                </Text>
              </View>
              <TimeElapsed createdAt={order.created_at} />
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.emptyOrders}>
            <Text variant="bodyMedium" style={styles.muted}>
              {t('orders.noActiveOrdersForTable')}
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      <FAB
        icon="plus"
        label={t('orders.newOrder')}
        onPress={handleCreateOrder}
        style={styles.fab}
      />

      <ConfirmDialog
        visible={!!statusConfirm}
        title={t('tables.changeStatus')}
        message={t('tables.changeStatusConfirm', {
          number: table.table_number,
          status: statusConfirm,
        })}
        onConfirm={() => statusConfirm && handleStatusChange(statusConfirm)}
        onCancel={() => setStatusConfirm(null)}
      />

      <TransferTableModal
        visible={transferOpen}
        sourceTable={{ id: table.id, table_number: table.table_number }}
        onDismiss={() => setTransferOpen(false)}
        onSuccess={() => {
          setTransferOpen(false);
          showSuccess(t('tables.tableTransferred'));
          refetch();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerSection: { gap: 12 },
  card: { marginHorizontal: 16, marginTop: 12 },
  callCard: { borderLeftWidth: 4, borderLeftColor: COLORS.danger },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bold: { fontWeight: '700', color: COLORS.textPrimary },
  muted: { color: COLORS.textMuted, marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  statusChip: {},
  transferBtn: { marginTop: 12, alignSelf: 'flex-start' },
  callItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  callInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reasonChip: {},
  sectionTitle: {
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginHorizontal: 16,
    marginTop: 16,
  },
  orderCard: { marginHorizontal: 16, marginTop: 8 },
  emptyOrders: { alignItems: 'center', paddingVertical: 32 },
  listContent: { paddingBottom: 100 },
  fab: { position: 'absolute', right: 16, bottom: 24 },
});
