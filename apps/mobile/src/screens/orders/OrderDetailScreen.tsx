import { useTranslation } from '@gustri/i18n';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { FlashList } from '@shopify/flash-list';
import { useMemo } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { OrderItemRow } from '@/components/orders/OrderItemRow';
import { StatusActions } from '@/components/orders/StatusActions';
import { ErrorScreen, LoadingScreen, StatusBadge, TimeElapsed } from '@/components/ui';
import {
  useCurrencySymbol,
  useOrder,
  useOrderPayments,
  useUpdateOrderItemStatus,
  useUpdateOrderStatus,
} from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';
import { Text } from '@/lib/paper-compat';
import { useAuthStore } from '@/store/auth-store';
import { CARD_RADIUS, COLORS } from '@/theme';
import type { Order, OrderItemWithMenuItem, OrderPayment, OrdersStackParamList } from '@/types';

type Route = RouteProp<OrdersStackParamList, 'OrderDetail'>;
type Nav = StackNavigationProp<OrdersStackParamList, 'OrderDetail'>;

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
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');

  const { data: order, isLoading, error, refetch } = useOrder(orderId);
  const { data: payments } = useOrderPayments(orderId);
  const updateOrderStatus = useUpdateOrderStatus();
  const updateItemStatus = useUpdateOrderItemStatus();

  const currencySymbol = useCurrencySymbol();

  const details = order as OrderWithJoins | undefined;

  const totalPaid = useMemo(
    () => payments?.reduce((sum: number, p: OrderPayment) => sum + (p.amount || 0), 0) || 0,
    [payments],
  );

  const remaining = (order?.total ?? 0) - totalPaid;
  const items = details?.order_items || [];

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      await updateOrderStatus.mutateAsync({
        orderId,
        status: newStatus as Order['status'],
      });
      showSuccess(t('orders.orderStatusChanged', { status: newStatus }));
    } catch (err: unknown) {
      showError(err instanceof Error ? err : t('orders.failedUpdateStatus'));
    }
  };

  const handleMarkItemReady = async (itemId: string) => {
    try {
      await updateItemStatus.mutateAsync({ itemId, status: 'ready' });
      showSuccess(t('orders.itemMarkedAs', { status: 'ready' }));
    } catch (err: unknown) {
      showError(err instanceof Error ? err : t('orders.failedUpdateItemStatus'));
    }
  };

  if (isLoading) return <LoadingScreen />;
  if (error || !order)
    return <ErrorScreen error={error || t('orders.orderNotFound')} onRetry={refetch} />;

  const tableLabel = details?.table
    ? t('tables.tableHash', { number: details.table.table_number })
    : order.order_type === 'takeout'
      ? t('orders.takeout')
      : order.order_type === 'delivery'
        ? t('orders.delivery')
        : '—';

  return (
    <View style={styles.container}>
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        ListHeaderComponent={
          <View>
            {/* Order Info */}
            <View style={styles.section}>
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
                  {t('orders.waiterLabel', { name: details.assigned_waiter.full_name })}
                </Text>
              )}
              <TimeElapsed createdAt={order.created_at} />
            </View>

            {/* Status Actions */}
            <View style={styles.section}>
              <StatusActions
                status={order.status}
                hasItems={items.filter((i) => i.status !== 'cancelled').length > 0}
                onUpdateStatus={handleUpdateStatus}
                onNavigatePayment={() => navigation.navigate('OrderPayment', { orderId })}
                onNavigateAddItems={() => navigation.navigate('AddItems', { orderId })}
                isLoading={updateOrderStatus.isPending}
              />
            </View>

            {/* Payment Summary */}
            {totalPaid > 0 && (
              <View style={styles.section}>
                <Text variant="titleMedium" style={styles.bold}>
                  {t('orders.payment')}
                </Text>
                <View style={styles.paymentRow}>
                  <Text variant="bodyMedium" style={styles.muted}>
                    {tCommon('total')}
                  </Text>
                  <Text variant="bodyMedium" style={styles.bold}>
                    {currencySymbol}
                    {(order.total ?? 0).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.paymentRow}>
                  <Text variant="bodyMedium" style={styles.muted}>
                    {t('orders.paid')}
                  </Text>
                  <Text variant="bodyMedium" style={{ color: COLORS.success, fontWeight: '600' }}>
                    {currencySymbol}
                    {totalPaid.toFixed(2)}
                  </Text>
                </View>
                {remaining > 0 && (
                  <View style={styles.paymentRow}>
                    <Text variant="bodyMedium" style={styles.muted}>
                      {t('orders.remaining')}
                    </Text>
                    <Text variant="bodyMedium" style={{ color: COLORS.danger, fontWeight: '600' }}>
                      {currencySymbol}
                      {remaining.toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Discount Info */}
            {(order.discount_amount ?? 0) > 0 && (
              <View style={styles.section}>
                <View style={styles.paymentRow}>
                  <Text variant="bodyMedium" style={styles.muted}>
                    {t('orders.discount')} (
                    {order.discount_type === 'percentage'
                      ? `${order.discount_value}%`
                      : `${currencySymbol}${(order.discount_value ?? 0).toFixed(2)}`}
                    )
                  </Text>
                  <Text variant="bodyMedium" style={{ color: COLORS.danger, fontWeight: '600' }}>
                    -{currencySymbol}
                    {(order.discount_amount ?? 0).toFixed(2)}
                  </Text>
                </View>
                {order.discount_reason ? (
                  <Text variant="bodySmall" style={styles.muted}>
                    {order.discount_reason}
                  </Text>
                ) : null}
              </View>
            )}

            {/* Items header */}
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {t('orders.orderItems')} ({items.length})
            </Text>
          </View>
        }
        renderItem={({ item }: { item: OrderItemWithMenuItem }) => (
          <View style={styles.itemWrapper}>
            <OrderItemRow
              item={item}
              currencySymbol={currencySymbol}
              showActions={
                staff?.role === 'kitchen' || staff?.role === 'admin' || staff?.role === 'owner'
              }
              onMarkReady={handleMarkItemReady}
            />
          </View>
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text variant="titleMedium" style={styles.bold}>
                {tCommon('total')}
              </Text>
              <Text variant="titleLarge" style={styles.bold}>
                {currencySymbol}
                {(order.total ?? 0).toFixed(2)}
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
  container: { flex: 1, backgroundColor: COLORS.background },
  section: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: CARD_RADIUS,
    padding: 16,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bold: { fontWeight: '700', color: COLORS.textPrimary },
  muted: { color: COLORS.textMuted },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: {
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
  },
  itemWrapper: { marginHorizontal: 16 },
  footer: { marginHorizontal: 16, marginTop: 8, marginBottom: 24 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listContent: { paddingBottom: 32 },
});
