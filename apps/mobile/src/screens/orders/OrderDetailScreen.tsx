import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Card, Divider, Text } from 'react-native-paper';
import { OrderItemRow } from '@/components/orders/OrderItemRow';
import { StatusActions } from '@/components/orders/StatusActions';
import { ErrorScreen, LoadingScreen, StatusBadge, TimeElapsed } from '@/components/ui';
import {
  useOrder,
  useOrderPayments,
  useUpdateOrderItemStatus,
  useUpdateOrderStatus,
} from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';
import { useAuthStore } from '@/store/auth-store';
import type { Order, OrderItemWithMenuItem, OrderPayment, OrdersStackParamList } from '@/types';

type Route = RouteProp<OrdersStackParamList, 'OrderDetail'>;
type Nav = StackNavigationProp<OrdersStackParamList, 'OrderDetail'>;

// The wrapper's findById returns joined data beyond the base Order type
type OrderWithJoins = Order & {
  table?: { table_number: string; location: string | null };
  order_items?: OrderItemWithMenuItem[];
  assigned_waiter?: { full_name: string } | null;
};

export default function OrderDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { orderId } = route.params;
  const staff = useAuthStore((s) => s.staff);
  const { showSuccess, showError } = useSnackbar();

  const { data: order, isLoading, error, refetch } = useOrder(orderId);
  const { data: payments } = useOrderPayments(orderId);
  const updateOrderStatus = useUpdateOrderStatus();
  const updateItemStatus = useUpdateOrderItemStatus();

  // Cast order to include join fields (wrapper's select includes table, order_items, assigned_waiter)
  const details = order as OrderWithJoins | undefined;

  const totalPaid = useMemo(
    () => payments?.reduce((sum: number, p: OrderPayment) => sum + (p.amount || 0), 0) || 0,
    [payments],
  );

  const remaining = (order?.total || 0) - totalPaid;
  const items = details?.order_items || [];

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      await updateOrderStatus.mutateAsync({
        orderId,
        status: newStatus as Order['status'],
      });
      showSuccess(`Order ${newStatus}`);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleMarkItemReady = async (itemId: string) => {
    try {
      await updateItemStatus.mutateAsync({ itemId, status: 'ready' });
      showSuccess('Item marked as ready');
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to update item');
    }
  };

  if (isLoading) return <LoadingScreen />;
  if (error || !order) return <ErrorScreen error={error || 'Order not found'} onRetry={refetch} />;

  const tableLabel = details?.table
    ? `Table #${details.table.table_number}`
    : order.order_type === 'takeout'
      ? 'Takeout'
      : order.order_type === 'delivery'
        ? 'Delivery'
        : '—';

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        ListHeaderComponent={
          <View>
            {/* Order Info */}
            <Card style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.row}>
                  <Text variant="headlineSmall" style={styles.bold}>
                    #{order.order_number || '—'}
                  </Text>
                  <StatusBadge status={order.status} type="order" />
                </View>
                <Text variant="bodyMedium" style={styles.muted}>
                  {tableLabel}
                </Text>
                {details?.assigned_waiter?.full_name && (
                  <Text variant="bodySmall" style={styles.muted}>
                    Waiter: {details.assigned_waiter.full_name}
                  </Text>
                )}
                <TimeElapsed createdAt={order.created_at} />
              </Card.Content>
            </Card>

            {/* Status Actions */}
            <Card style={styles.card}>
              <Card.Content>
                <StatusActions
                  status={order.status}
                  onUpdateStatus={handleUpdateStatus}
                  onNavigatePayment={() => navigation.navigate('OrderPayment', { orderId })}
                  onNavigateAddItems={() => navigation.navigate('AddItems', { orderId })}
                  isLoading={updateOrderStatus.isPending}
                />
              </Card.Content>
            </Card>

            {/* Payment Summary */}
            {totalPaid > 0 && (
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleMedium" style={styles.bold}>
                    Payment
                  </Text>
                  <View style={styles.paymentRow}>
                    <Text variant="bodyMedium" style={styles.muted}>
                      Total
                    </Text>
                    <Text variant="bodyMedium" style={styles.bold}>
                      ${(order.total || 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.paymentRow}>
                    <Text variant="bodyMedium" style={styles.muted}>
                      Paid
                    </Text>
                    <Text variant="bodyMedium" style={{ color: '#10b981', fontWeight: '600' }}>
                      ${totalPaid.toFixed(2)}
                    </Text>
                  </View>
                  {remaining > 0 && (
                    <View style={styles.paymentRow}>
                      <Text variant="bodyMedium" style={styles.muted}>
                        Remaining
                      </Text>
                      <Text variant="bodyMedium" style={{ color: '#ef4444', fontWeight: '600' }}>
                        ${remaining.toFixed(2)}
                      </Text>
                    </View>
                  )}
                </Card.Content>
              </Card>
            )}

            {/* Items header */}
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Items ({items.length})
            </Text>
          </View>
        }
        renderItem={({ item }: { item: OrderItemWithMenuItem }) => (
          <View style={styles.itemWrapper}>
            <OrderItemRow
              item={item}
              showActions={
                staff?.role === 'kitchen' || staff?.role === 'admin' || staff?.role === 'owner'
              }
              onMarkReady={handleMarkItemReady}
            />
          </View>
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <Divider style={styles.divider} />
            <View style={styles.totalRow}>
              <Text variant="titleMedium" style={styles.bold}>
                Total
              </Text>
              <Text variant="titleLarge" style={styles.bold}>
                ${(order.total || 0).toFixed(2)}
              </Text>
            </View>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  card: { marginHorizontal: 16, marginTop: 12 },
  cardContent: { gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bold: { fontWeight: '700', color: '#1e293b' },
  muted: { color: '#6b7280' },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: {
    fontWeight: '600',
    color: '#1e293b',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
  },
  itemWrapper: { marginHorizontal: 16 },
  footer: { marginHorizontal: 16, marginTop: 8, marginBottom: 24 },
  divider: { marginVertical: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listContent: { paddingBottom: 32 },
});
