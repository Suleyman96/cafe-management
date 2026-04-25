import { useTranslation } from '@gustri/i18n';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { StatusBadge, TimeElapsed } from '@/components/ui';
import { Text } from '@/lib/paper-compat';
import { COLORS } from '@/theme';

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

const TYPE_STYLES: Record<string, { borderColor: string; backgroundColor: string; label: string }> =
  {
    delivery: { borderColor: '#d8b4fe', backgroundColor: '#faf5ff', label: 'orders.delivery' },
    takeout: { borderColor: '#fdba74', backgroundColor: '#fff7ed', label: 'orders.takeout' },
  };

export const OrderCard = React.memo(function OrderCard({
  order,
  currencySymbol,
  onPress,
}: OrderCardProps) {
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');

  const typeStyle = TYPE_STYLES[order.order_type || ''];

  const tableLabel = order.table
    ? `Table #${order.table.table_number}`
    : order.order_type === 'takeout'
      ? t('orders.takeout')
      : order.order_type === 'delivery'
        ? t('orders.delivery')
        : '—';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        typeStyle && {
          borderColor: typeStyle.borderColor,
          backgroundColor: typeStyle.backgroundColor,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
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
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 12,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
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
    color: COLORS.textPrimary,
  },
  muted: {
    color: COLORS.textMuted,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  meta: {
    flexDirection: 'row',
    gap: 12,
  },
  total: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});
