import { MaterialCommunityIcons } from '@expo/vector-icons';
import { calculateOrderTotal } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card } from 'react-native-paper';
import { StatusBadge, TimeElapsed } from '@/components/ui';
import { Text } from '@/lib/paper-compat';

interface TakeoutOrderCardProps {
  order: {
    id: string;
    order_number?: string | null;
    status: string;
    created_at: string;
    total_amount?: number | null;
    total?: number | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    order_items?: Array<{
      id: string;
      quantity: number;
      item_price: number;
      status?: string;
      notes?: string | null;
      menu_item?: { name?: string | null } | null;
    }>;
  };
  currencySymbol?: string;
  onApprove?: (orderId: string) => void;
  onStartPreparing?: (orderId: string) => void;
  onMarkReady?: (orderId: string) => void;
  onCancel?: (orderId: string) => void;
}

export const TakeoutOrderCard = React.memo(function TakeoutOrderCard({
  order,
  currencySymbol = '$',
  onApprove,
  onStartPreparing,
  onMarkReady,
  onCancel,
}: TakeoutOrderCardProps) {
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');

  const grandTotal = calculateOrderTotal({ ...order, total: order.total ?? order.total_amount });
  const hasItems = order.order_items?.some((i) => i.status !== 'cancelled') ?? false;

  return (
    <Card style={styles.card}>
      <Card.Content style={styles.content}>
        {/* Header: Package icon + status + order number + total */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.statusRow}>
              <MaterialCommunityIcons name="shopping" size={18} color="#ea580c" />
              <StatusBadge status={order.status} type="order" />
              {order.order_number && (
                <Text variant="bodySmall" style={styles.orderNumber}>
                  #{order.order_number}
                </Text>
              )}
            </View>
            <View style={styles.metaRow}>
              <TimeElapsed createdAt={order.created_at} showColor />
              {order.customer_name && (
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="account" size={12} color="#6b7280" />
                  <Text variant="bodySmall" style={styles.metaText} numberOfLines={1}>
                    {order.customer_name}
                  </Text>
                </View>
              )}
              {order.customer_phone && (
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="phone" size={12} color="#6b7280" />
                  <Text variant="bodySmall" style={styles.metaText}>
                    {order.customer_phone}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text variant="titleSmall" style={styles.grandTotal}>
              {currencySymbol}
              {grandTotal.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Order Items Preview */}
        {order.order_items && order.order_items.length > 0 && (
          <View style={styles.itemsPreview}>
            {order.order_items.slice(0, 3).map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Text variant="bodySmall" style={styles.itemText}>
                  {item.quantity}x {item.menu_item?.name || 'Item'}
                </Text>
                {item.notes && (
                  <Text variant="bodySmall" style={styles.itemNotes}>
                    {' '}
                    ({item.notes})
                  </Text>
                )}
              </View>
            ))}
            {order.order_items.length > 3 && (
              <Text variant="bodySmall" style={styles.moreItems}>
                +{order.order_items.length - 3} more items
              </Text>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          {order.status === 'pending_approval' && onApprove && (
            <Button
              compact
              mode="contained"
              onPress={() => onApprove(order.id)}
              style={styles.approveBtn}
            >
              {tCommon('approve')}
            </Button>
          )}
          {order.status === 'new' && onStartPreparing && (
            <Button
              compact
              mode="contained"
              disabled={!hasItems}
              onPress={() => onStartPreparing(order.id)}
              style={styles.prepareBtn}
            >
              {t('takeout.startPreparing')}
            </Button>
          )}
          {order.status === 'preparing' && onMarkReady && (
            <Button
              compact
              mode="contained"
              disabled={!hasItems}
              onPress={() => onMarkReady(order.id)}
              style={styles.readyBtn}
            >
              {t('takeout.readyForPickup')}
            </Button>
          )}
          {!['ready', 'closed', 'cancelled'].includes(order.status) && onCancel && (
            <Button compact onPress={() => onCancel(order.id)} textColor="#ef4444">
              {order.status === 'pending_approval' ? tCommon('reject') : tCommon('cancel')}
            </Button>
          )}
        </View>
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderColor: '#fdba74',
    borderWidth: 1,
    backgroundColor: '#fff',
  },
  content: { gap: 8 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: { flex: 1, gap: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderNumber: { color: '#9ca3af', fontSize: 11 },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { color: '#6b7280', fontSize: 11 },
  headerRight: { alignItems: 'flex-end', marginLeft: 8 },
  grandTotal: { fontWeight: '700', color: '#1e293b' },
  itemsPreview: { gap: 1 },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemText: { color: '#6b7280', fontSize: 12 },
  itemNotes: { color: '#9ca3af', fontSize: 10 },
  moreItems: { color: '#9ca3af', fontSize: 11 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  approveBtn: { backgroundColor: '#16a34a' },
  prepareBtn: { backgroundColor: '#f59e0b' },
  readyBtn: { backgroundColor: '#ea580c' },
});
