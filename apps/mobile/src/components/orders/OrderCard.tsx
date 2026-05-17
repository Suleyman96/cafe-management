import { useTranslation } from '@gustri/i18n';
import { StatusBadge, TimeElapsed } from '@gustri/ui-mobile';
import React, { useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/lib/paper-compat';
import { CARD_PADDING, CARD_RADIUS, COLORS, TYPOGRAPHY } from '@/theme';

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
  onPress: (orderId: string) => void;
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

  const handlePress = useCallback(() => onPress(order.id), [onPress, order.id]);

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
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${t('orders.orderHash', { number: order.order_number || '—' })}, ${order.status}`}
    >
      <View style={styles.topRow}>
        <View style={styles.leftInfo}>
          <Text style={styles.orderNumber}>#{order.order_number || '—'}</Text>
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
    borderRadius: CARD_RADIUS,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: CARD_PADDING,
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
    ...TYPOGRAPHY.cardTitle,
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
