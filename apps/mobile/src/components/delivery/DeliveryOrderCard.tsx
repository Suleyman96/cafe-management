import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card } from 'react-native-paper';
import { StatusBadge, TimeElapsed } from '@/components/ui';
import { Text } from '@/lib/paper-compat';

interface DeliveryOrderCardProps {
  order: {
    id: string;
    order_number?: string | null;
    status: string;
    created_at: string;
    total_amount?: number | null;
    delivery_address?: string | null;
    delivery_fee?: number | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    order_items?: Array<{
      id: string;
      quantity: number;
      menu_item?: { name_en?: string | null } | null;
    }>;
    delivery_person?: { full_name: string } | null;
  };
  currencySymbol?: string;
  onApprove?: (orderId: string) => void;
  onStartPreparing?: (orderId: string) => void;
  onMarkReady?: (orderId: string) => void;
  onSendOut?: (orderId: string) => void;
  onMarkDelivered?: (orderId: string) => void;
  onCancel?: (orderId: string) => void;
}

export const DeliveryOrderCard = React.memo(function DeliveryOrderCard({
  order,
  currencySymbol = '$',
  onApprove,
  onStartPreparing,
  onMarkReady,
  onSendOut,
  onMarkDelivered,
  onCancel,
}: DeliveryOrderCardProps) {
  const itemCount = order.order_items?.reduce((sum, i) => sum + i.quantity, 0) || 0;

  return (
    <Card style={styles.card}>
      <Card.Content style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.orderInfo}>
            <Text variant="titleMedium" style={styles.orderNumber}>
              #{order.order_number || '—'}
            </Text>
            <StatusBadge status={order.status} type="order" />
          </View>
          <TimeElapsed createdAt={order.created_at} showColor />
        </View>

        {order.customer_name && (
          <Text variant="bodyMedium" style={styles.customerName}>
            {order.customer_name}
          </Text>
        )}
        {order.delivery_address && (
          <Text variant="bodySmall" style={styles.muted} numberOfLines={2}>
            {order.delivery_address}
          </Text>
        )}
        {order.customer_phone && (
          <Text variant="bodySmall" style={styles.muted}>
            {order.customer_phone}
          </Text>
        )}

        <View style={styles.detailRow}>
          <Text variant="bodySmall" style={styles.muted}>
            {itemCount} item{itemCount !== 1 ? 's' : ''}
          </Text>
          <Text variant="titleSmall" style={styles.total}>
            {currencySymbol}
            {(order.total_amount || 0).toFixed(2)}
          </Text>
        </View>

        {order.delivery_person && (
          <Text variant="bodySmall" style={styles.driver}>
            Driver: {order.delivery_person.full_name}
          </Text>
        )}

        <View style={styles.actions}>
          {order.status === 'pending_approval' && onApprove && (
            <Button compact mode="contained" onPress={() => onApprove(order.id)}>
              Approve
            </Button>
          )}
          {order.status === 'new' && onStartPreparing && (
            <Button
              compact
              mode="contained"
              onPress={() => onStartPreparing(order.id)}
              style={{ backgroundColor: '#f59e0b' }}
            >
              Start Preparing
            </Button>
          )}
          {order.status === 'preparing' && onMarkReady && (
            <Button
              compact
              mode="contained"
              onPress={() => onMarkReady(order.id)}
              style={{ backgroundColor: '#10b981' }}
            >
              Mark Ready
            </Button>
          )}
          {order.status === 'ready' && onSendOut && (
            <Button
              compact
              mode="contained"
              onPress={() => onSendOut(order.id)}
              style={{ backgroundColor: '#3b82f6' }}
            >
              Send Out
            </Button>
          )}
          {order.status === 'out_for_delivery' && onMarkDelivered && (
            <Button
              compact
              mode="contained"
              onPress={() => onMarkDelivered(order.id)}
              style={{ backgroundColor: '#10b981' }}
            >
              Delivered
            </Button>
          )}
          {!['delivered', 'cancelled', 'paid'].includes(order.status) && onCancel && (
            <Button compact onPress={() => onCancel(order.id)} textColor="#ef4444">
              Cancel
            </Button>
          )}
        </View>
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 8 },
  content: { gap: 6 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderNumber: { fontWeight: '800', color: '#1e293b' },
  customerName: { fontWeight: '600', color: '#1e293b' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { fontWeight: '700', color: '#1e293b' },
  driver: { color: '#3b82f6', fontWeight: '500', fontSize: 12 },
  muted: { color: '#6b7280' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
});
