import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, FAB, Text } from 'react-native-paper';
import {
  ConfirmDialog,
  ErrorScreen,
  LoadingScreen,
  StatusBadge,
  TimeElapsed,
} from '@/components/ui';
import {
  useCreateOrder,
  useOrders,
  useTable,
  useUpdateTableStatus,
  useUpdateWaiterCall,
  useWaiterCalls,
} from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';
import { useAuthStore } from '@/store/auth-store';
import { TABLE_STATUS_COLORS } from '@/theme';
import type { TablesStackParamList } from '@/types';

type Route = RouteProp<TablesStackParamList, 'TableDetail'>;
type Nav = StackNavigationProp<TablesStackParamList, 'TableDetail'>;

const ACTIVE_STATUSES = ['pending_approval', 'new', 'preparing', 'ready', 'served'];
const TABLE_STATUSES = ['free', 'occupied', 'reserved', 'closed'] as const;

export default function TableDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { tableId } = route.params;
  const staff = useAuthStore((s) => s.staff);
  const { showSuccess, showError } = useSnackbar();

  const { data: table, isLoading, error, refetch } = useTable(tableId);
  const { data: orders } = useOrders();
  const { data: waiterCalls } = useWaiterCalls('pending');
  const createOrder = useCreateOrder();
  const updateTableStatus = useUpdateTableStatus();
  const updateWaiterCall = useUpdateWaiterCall();

  const [statusConfirm, setStatusConfirm] = useState<string | null>(null);

  const activeOrders = useMemo(
    () => orders?.filter((o) => o.table_id === tableId && ACTIVE_STATUSES.includes(o.status)) || [],
    [orders, tableId],
  );

  const pendingCalls = useMemo(
    () => waiterCalls?.filter((c) => c.table_id === tableId) || [],
    [waiterCalls, tableId],
  );

  const handleCreateOrder = async () => {
    try {
      const order = await createOrder.mutateAsync({
        table_id: tableId,
        order_type: 'dine_in',
        status: 'new',
        assigned_waiter_id: staff?.id,
      });
      navigation.getParent()?.navigate('OrdersTab', {
        screen: 'AddItems',
        params: { orderId: order.id },
      });
    } catch (err: any) {
      showError(err?.message || 'Failed to create order');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateTableStatus.mutateAsync({ tableId, status: newStatus });
      showSuccess(`Table set to ${newStatus}`);
      setStatusConfirm(null);
    } catch (err: any) {
      showError(err?.message || 'Failed to update status');
    }
  };

  const handleRespondCall = async (callId: string) => {
    try {
      await updateWaiterCall.mutateAsync({
        callId,
        status: 'acknowledged',
        staffId: staff?.id,
      });
      showSuccess('Call acknowledged');
    } catch (err: any) {
      showError(err?.message || 'Failed to respond');
    }
  };

  if (isLoading) return <LoadingScreen />;
  if (error || !table) return <ErrorScreen error={error || 'Table not found'} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={activeOrders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.row}>
                  <Text variant="headlineMedium" style={styles.bold}>
                    Table #{table.table_number}
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
                    Capacity: {table.capacity}
                  </Text>
                )}
                <View style={styles.chipRow}>
                  {TABLE_STATUSES.map((s) => (
                    <Chip
                      key={s}
                      selected={table.status === s}
                      onPress={() => {
                        if (table.status !== s) setStatusConfirm(s);
                      }}
                      compact
                      style={[
                        styles.statusChip,
                        table.status === s && { backgroundColor: TABLE_STATUS_COLORS[s] },
                      ]}
                      textStyle={table.status === s ? { color: '#fff' } : undefined}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Chip>
                  ))}
                </View>
              </Card.Content>
            </Card>

            {pendingCalls.length > 0 && (
              <Card style={[styles.card, styles.callCard]}>
                <Card.Content>
                  <Text variant="titleMedium" style={styles.bold}>
                    Waiter Calls
                  </Text>
                  {pendingCalls.map((call) => (
                    <View key={call.id} style={styles.callItem}>
                      <View style={styles.callInfo}>
                        <Chip compact style={styles.reasonChip}>
                          {call.reason || 'Assistance'}
                        </Chip>
                        <TimeElapsed createdAt={call.created_at} />
                      </View>
                      <Button compact mode="contained" onPress={() => handleRespondCall(call.id)}>
                        Respond
                      </Button>
                    </View>
                  ))}
                </Card.Content>
              </Card>
            )}

            {activeOrders.length > 0 && (
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Active Orders ({activeOrders.length})
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
                  #{order.order_number || '—'}
                </Text>
                <StatusBadge status={order.status} type="order" />
              </View>
              <View style={styles.row}>
                <Text variant="bodySmall" style={styles.muted}>
                  {(order as any).order_items?.length || 0} items
                </Text>
                <Text variant="bodyMedium" style={styles.bold}>
                  ${(order.total || 0).toFixed(2)}
                </Text>
              </View>
              <TimeElapsed createdAt={order.created_at} />
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.emptyOrders}>
            <Text variant="bodyMedium" style={styles.muted}>
              No active orders for this table
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      <FAB
        icon="plus"
        label="New Order"
        onPress={handleCreateOrder}
        loading={createOrder.isPending}
        style={styles.fab}
      />

      <ConfirmDialog
        visible={!!statusConfirm}
        title="Change Table Status"
        message={`Set table #${table.table_number} to "${statusConfirm}"?`}
        onConfirm={() => statusConfirm && handleStatusChange(statusConfirm)}
        onCancel={() => setStatusConfirm(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  headerSection: { gap: 12 },
  card: { marginHorizontal: 16, marginTop: 12 },
  callCard: { borderLeftWidth: 4, borderLeftColor: '#ef4444' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bold: { fontWeight: '700', color: '#1e293b' },
  muted: { color: '#6b7280', marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  statusChip: {},
  callItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  callInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reasonChip: { backgroundColor: '#fee2e2' },
  sectionTitle: { fontWeight: '600', color: '#1e293b', marginHorizontal: 16, marginTop: 16 },
  orderCard: { marginHorizontal: 16, marginTop: 8 },
  emptyOrders: { alignItems: 'center', paddingVertical: 32 },
  listContent: { paddingBottom: 100 },
  fab: { position: 'absolute', right: 16, bottom: 24 },
});
