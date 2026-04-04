import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Badge, Card, Text } from 'react-native-paper';
import { StatusBadge } from '@/components/ui';
import { TABLE_STATUS_COLORS } from '@/theme';

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
    <Card style={[styles.card, { borderLeftColor: borderColor }]} onPress={onPress}>
      <Card.Content style={styles.content}>
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.tableNumber}>
            #{table.table_number}
          </Text>
          {hasWaiterCall && <Badge size={12} style={styles.callBadge} />}
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
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 4,
    borderLeftWidth: 4,
  },
  content: {
    gap: 6,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tableNumber: {
    fontWeight: '700',
    color: '#1e293b',
  },
  callBadge: {
    backgroundColor: '#ef4444',
  },
  location: {
    color: '#6b7280',
  },
  orderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  orderCount: {
    color: '#6b7280',
  },
  orderTotal: {
    color: '#1e293b',
    fontWeight: '600',
  },
});
