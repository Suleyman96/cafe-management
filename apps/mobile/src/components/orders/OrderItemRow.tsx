import { useTranslation } from '@gustri/i18n';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { StatusBadge } from '@/components/ui';
import { Text } from '@/lib/paper-compat';
import { COLORS } from '@/theme';

interface OrderItemRowProps {
  item: {
    id: string;
    quantity: number;
    unit_price?: number | null;
    item_price?: number | null;
    total_price?: number | null;
    status: string;
    notes?: string | null;
    menu_item?: {
      name?: string | null;
    } | null;
  };
  currencySymbol: string;
  showActions?: boolean;
  onMarkReady?: (itemId: string) => void;
}

export const OrderItemRow = React.memo(function OrderItemRow({
  item,
  currencySymbol,
  showActions = false,
  onMarkReady,
}: OrderItemRowProps) {
  const { t } = useTranslation('staff');

  const name = item.menu_item?.name || 'Unknown Item';

  return (
    <View style={styles.container}>
      <View style={styles.mainRow}>
        <View style={styles.left}>
          <Text variant="bodyMedium" style={styles.name}>
            {item.quantity}x {name}
          </Text>
          {item.notes && (
            <Text variant="bodySmall" style={styles.notes}>
              {t('orders.note')} {item.notes}
            </Text>
          )}
        </View>
        <View style={styles.right}>
          <Text variant="bodyMedium" style={styles.price}>
            {currencySymbol}
            {(
              item.total_price ?? (item.item_price ?? item.unit_price ?? 0) * item.quantity
            ).toFixed(2)}
          </Text>
          <StatusBadge status={item.status} type="orderItem" />
        </View>
      </View>

      {showActions && onMarkReady && (item.status === 'pending' || item.status === 'preparing') && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onMarkReady(item.id)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`${t('orders.markReady')} — ${name}`}
        >
          <Text style={styles.actionButtonText}>{t('orders.markReady')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  mainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  left: {
    flex: 1,
    marginRight: 12,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  name: {
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  notes: {
    color: COLORS.warning,
    fontStyle: 'italic',
    marginTop: 2,
  },
  price: {
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  actionButton: {
    alignSelf: 'flex-end',
    marginTop: 6,
    backgroundColor: COLORS.success,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
