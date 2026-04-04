import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { StatusBadge } from '@/components/ui';

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
      name_en?: string | null;
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
  const name = item.menu_item?.name || item.menu_item?.name_en || 'Unknown Item';

  return (
    <View style={styles.container}>
      <View style={styles.mainRow}>
        <View style={styles.left}>
          <Text variant="bodyMedium" style={styles.name}>
            {item.quantity}x {name}
          </Text>
          {item.notes && (
            <Text variant="bodySmall" style={styles.notes}>
              Note: {item.notes}
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
        <Button
          compact
          mode="contained-tonal"
          onPress={() => onMarkReady(item.id)}
          style={styles.actionButton}
        >
          Mark Ready
        </Button>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
    color: '#1e293b',
  },
  notes: {
    color: '#f59e0b',
    fontStyle: 'italic',
    marginTop: 2,
  },
  price: {
    fontWeight: '600',
    color: '#1e293b',
  },
  actionButton: {
    alignSelf: 'flex-end',
    marginTop: 6,
  },
});
