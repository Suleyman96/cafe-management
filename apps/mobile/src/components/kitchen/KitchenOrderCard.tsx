import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Text } from 'react-native-paper';
import { StatusBadge, TimeElapsed } from '@/components/ui';

interface KitchenOrderCardProps {
  order: {
    id: string;
    order_number?: string | null;
    status: string;
    created_at: string;
    order_type?: string | null;
    table?: { table_number: string } | null;
    order_items?: Array<{
      id: string;
      quantity: number;
      status: string;
      notes?: string | null;
      menu_item?: { name?: string | null } | null;
    }>;
  };
  onStartPreparing: (orderId: string) => void;
  onMarkItemReady: (itemId: string) => void;
  onMarkAllReady: (orderId: string) => void;
}

export const KitchenOrderCard = React.memo(function KitchenOrderCard({
  order,
  onStartPreparing,
  onMarkItemReady,
  onMarkAllReady,
}: KitchenOrderCardProps) {
  const activeItems =
    order.order_items?.filter((i) => i.status !== 'served' && i.status !== 'cancelled') || [];

  const allItemsReady = activeItems.length > 0 && activeItems.every((i) => i.status === 'ready');

  const tableLabel = order.table
    ? `Table #${order.table.table_number}`
    : order.order_type === 'takeout'
      ? 'Takeout'
      : order.order_type === 'delivery'
        ? 'Delivery'
        : '—';

  return (
    <Card style={styles.card}>
      <Card.Content>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text variant="titleLarge" style={styles.orderNumber}>
              #{order.order_number || '—'}
            </Text>
            <Chip compact textStyle={styles.chipText} style={styles.tableChip}>
              {tableLabel}
            </Chip>
          </View>
          <View style={styles.headerRight}>
            <TimeElapsed createdAt={order.created_at} showColor />
            <StatusBadge status={order.status} type="order" />
          </View>
        </View>

        {/* Items */}
        <View style={styles.items}>
          {activeItems.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text variant="bodyMedium" style={styles.itemName}>
                  {item.quantity}x {item.menu_item?.name || 'Unknown'}
                </Text>
                {item.notes && (
                  <Text variant="bodySmall" style={styles.itemNotes}>
                    {item.notes}
                  </Text>
                )}
              </View>
              {(item.status === 'new' || item.status === 'preparing') && (
                <Button
                  compact
                  mode="contained-tonal"
                  onPress={() => onMarkItemReady(item.id)}
                  labelStyle={styles.itemActionLabel}
                >
                  Ready
                </Button>
              )}
              {item.status === 'ready' && (
                <Chip compact style={styles.readyChip} textStyle={{ color: '#fff', fontSize: 11 }}>
                  Ready
                </Chip>
              )}
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {order.status === 'new' && (
            <Button
              mode="contained"
              onPress={() => onStartPreparing(order.id)}
              style={{ backgroundColor: '#f59e0b' }}
            >
              Start Preparing
            </Button>
          )}
          {order.status === 'preparing' && allItemsReady && (
            <Button
              mode="contained"
              onPress={() => onMarkAllReady(order.id)}
              style={{ backgroundColor: '#10b981' }}
            >
              All Ready
            </Button>
          )}
        </View>
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginBottom: 10,
    backgroundColor: '#262626',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  orderNumber: {
    fontWeight: '800',
    color: '#fff',
  },
  tableChip: {
    backgroundColor: '#404040',
  },
  chipText: {
    color: '#d1d5db',
    fontSize: 11,
  },
  items: {
    marginTop: 12,
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  itemInfo: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    color: '#e5e7eb',
    fontWeight: '500',
  },
  itemNotes: {
    color: '#f59e0b',
    fontStyle: 'italic',
  },
  itemActionLabel: {
    fontSize: 12,
  },
  readyChip: {
    backgroundColor: '#10b981',
  },
  actions: {
    marginTop: 12,
    gap: 8,
  },
});
