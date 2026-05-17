import { useTranslation } from '@gustri/i18n';
import { StatusBadge } from '@gustri/ui-mobile';
import React, { useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/lib/paper-compat';
import { CARD_PADDING, CARD_RADIUS, COLORS, TABLE_STATUS_COLORS, TYPOGRAPHY } from '@/theme';

interface TableCardProps {
  table: {
    id: string;
    table_number: string;
    status: string;
    location?: string | null;
    capacity?: number | null;
  };
  activeOrderCount: number;
  orderTotal: number;
  hasWaiterCall: boolean;
  currencySymbol: string;
  onPress: (tableId: string) => void;
}

export const TableCard = React.memo(function TableCard({
  table,
  activeOrderCount,
  orderTotal,
  hasWaiterCall,
  currencySymbol,
  onPress,
}: TableCardProps) {
  const { t } = useTranslation('staff');
  const handlePress = useCallback(() => onPress(table.id), [onPress, table.id]);
  const statusColors = TABLE_STATUS_COLORS[table.status];
  const backgroundColor = statusColors?.bg || COLORS.card;
  const borderColor = statusColors?.text || COLORS.border;

  const a11yParts = [
    t('tables.a11y.label', {
      number: table.table_number,
      status: t(`tables.${table.status}`, { defaultValue: table.status }),
    }),
  ];
  if (activeOrderCount > 0) {
    a11yParts.push(t('tables.a11y.activeOrders', { count: activeOrderCount }));
  }
  if (hasWaiterCall) {
    a11yParts.push(t('tables.a11y.waiterCallPending'));
  }
  const accessibilityLabel = a11yParts.join(', ');

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor, borderColor }, hasWaiterCall && styles.cardWithCall]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.header}>
        <Text style={styles.tableNumber}>#{table.table_number}</Text>
        {hasWaiterCall && <View style={styles.callDot} />}
      </View>

      <StatusBadge status={table.status} type="table" />

      {table.location && (
        <Text variant="bodySmall" style={styles.location}>
          {table.location}
        </Text>
      )}

      {activeOrderCount > 0 && (
        <View style={styles.orderInfo}>
          <Text variant="bodySmall" style={styles.orderCount}>
            {t('tables.orderCount', { count: activeOrderCount })}
          </Text>
          <Text variant="bodySmall" style={styles.orderTotal}>
            {currencySymbol}
            {orderTotal.toFixed(2)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 4,
    borderWidth: 1.5,
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
    backgroundColor: COLORS.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardWithCall: {
    shadowColor: '#ef4444',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  tableNumber: {
    ...TYPOGRAPHY.screenTitle,
    color: COLORS.textPrimary,
  },
  callDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.danger,
  },
  location: {
    color: COLORS.textMuted,
    marginTop: 4,
  },
  orderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  orderCount: {
    color: COLORS.textMuted,
  },
  orderTotal: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
});
