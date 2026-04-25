import { useTranslation } from '@gustri/i18n';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { StatusBadge, TimeElapsed } from '@/components/ui';

interface OrderCardProps {
  order: {
    id: string;
    order_number?: string | null;
    status: string;
    total?: number | null;
    created_at: string;
    order_type?: string | null;
    table_id?: string | null;
    order_items?: { id: string }[];
    table?: { table_number: string; location?: string | null } | null;
  };
  currencySymbol: string;
  onPress: () => void;
}

export const OrderCard = React.memo(function OrderCard({
  order,
  currencySymbol,
  onPress,
}: OrderCardProps) {
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');

  const tableLabel = order.table
    ? `Table #${order.table.table_number}`
    : order.order_type === 'takeout'
      ? t('orders.takeout')
      : order.order_type === 'delivery'
        ? t('orders.delivery')
        : '—';

  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Content style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.leftInfo}>
            <Text variant="titleMedium" style={styles.orderNumber}>
              #{order.order_number || '—'}
            </Text>
            <Text variant="bodySmall" style={styles.muted}>
              {tableLabel}
            </Text>
          </View>
          <StatusBadge status={order.status} type="order" />
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.meta}>
            <Text variant="bodySmall" style={styles.muted}>
              {order.order_items?.length || 0} {tCommon('items')}
            </Text>
            <TimeElapsed createdAt={order.created_at} showColor={false} />
          </View>
          <Text variant="titleSmall" style={styles.total}>
            {currencySymbol}
            {(order.total ?? 0).toFixed(2)}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  content: {
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leftInfo: {
    gap: 2,
  },
  orderNumber: {
    fontWeight: '700',
    color: '#1e293b',
  },
  muted: {
    color: '#6b7280',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: {
    flexDirection: 'row',
    gap: 12,
  },
  total: {
    fontWeight: '700',
    color: '#1e293b',
  },
});
