import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { StatusBadge } from '@/components/ui';
import { Text } from '@/lib/paper-compat';
import { COLORS, TABLE_STATUS_COLORS } from '@/theme';

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
  onPress: () => void;
}

export const TableCard = React.memo(function TableCard({
  table,
  activeOrderCount,
  orderTotal,
  hasWaiterCall,
  currencySymbol,
  onPress,
}: TableCardProps) {
  const borderColor = TABLE_STATUS_COLORS[table.status] || '#6b7280';

  return (
    <TouchableOpacity
      style={[styles.card, { borderColor }, hasWaiterCall && styles.cardWithCall]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.tableNumber}>
          #{table.table_number}
        </Text>
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
            {activeOrderCount} order{activeOrderCount > 1 ? 's' : ''}
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
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
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
    fontWeight: '700',
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
