import { MaterialCommunityIcons } from '@expo/vector-icons';
import { calculateOrderTotal } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import React from 'react';
import { Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
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
    total?: number | null;
    delivery_address?: string | null;
    delivery_fee?: number | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    order_items?: Array<{
      id: string;
      quantity: number;
      item_price: number;
      status?: string;
      notes?: string | null;
      menu_item?: { name_en?: string | null; name?: string | null } | null;
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

const openInMaps = (address: string) => {
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  Linking.openURL(url);
};

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
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');

  const grandTotal = calculateOrderTotal({ ...order, total: order.total ?? order.total_amount }); // already includes delivery_fee from DB
  const deliveryFee = order.delivery_fee ?? 0;
  const hasItems = order.order_items?.some((i) => i.status !== 'cancelled') ?? false;

  return (
    <Card style={styles.card}>
      <Card.Content style={styles.content}>
        {/* Header: Truck icon + status + order number + total */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.statusRow}>
              <MaterialCommunityIcons name="truck-delivery" size={18} color="#7c3aed" />
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
            {deliveryFee > 0 && (
              <Text variant="bodySmall" style={styles.deliveryFeeText}>
                incl. {currencySymbol}
                {deliveryFee.toFixed(2)} delivery
              </Text>
            )}
          </View>
        </View>

        {/* Delivery Address */}
        {order.delivery_address && (
          <View style={styles.addressRow}>
            <MaterialCommunityIcons
              name="map-marker"
              size={14}
              color="#7c3aed"
              style={styles.addressIcon}
            />
            <Text variant="bodySmall" style={styles.addressText} numberOfLines={2}>
              {order.delivery_address}
            </Text>
            <TouchableOpacity
              onPress={() => openInMaps(order.delivery_address!)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="google-maps" size={16} color="#7c3aed" />
            </TouchableOpacity>
          </View>
        )}

        {/* Delivery Person */}
        {order.delivery_person?.full_name && (
          <View style={styles.driverRow}>
            <MaterialCommunityIcons name="truck-delivery" size={13} color="#6b7280" />
            <Text variant="bodySmall" style={styles.driverText}>
              {t('delivery.driver')} {order.delivery_person.full_name}
            </Text>
          </View>
        )}

        {/* Order Items Preview */}
        {order.order_items && order.order_items.length > 0 && (
          <View style={styles.itemsPreview}>
            {order.order_items.slice(0, 3).map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Text variant="bodySmall" style={styles.itemText}>
                  {item.quantity}x {item.menu_item?.name_en || item.menu_item?.name || 'Item'}
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
                {t('delivery.moreItems', { count: order.order_items.length - 3 })}
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
              {t('delivery.startPreparing')}
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
              {t('delivery.markReady')}
            </Button>
          )}
          {order.status === 'ready' && onSendOut && (
            <Button
              compact
              mode="contained"
              disabled={!hasItems}
              onPress={() => onSendOut(order.id)}
              style={styles.outForDeliveryBtn}
            >
              {t('delivery.outForDelivery')}
            </Button>
          )}
          {order.status === 'out_for_delivery' && onMarkDelivered && (
            <Button
              compact
              mode="contained"
              disabled={!hasItems}
              onPress={() => onMarkDelivered(order.id)}
              style={styles.deliveredBtn}
            >
              {t('delivery.delivered')}
            </Button>
          )}
          {!['delivered', 'cancelled', 'closed'].includes(order.status) && onCancel && (
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
    borderColor: '#c4b5fd',
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
  deliveryFeeText: { color: '#9ca3af', fontSize: 10 },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f5f3ff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  addressIcon: { marginTop: 1 },
  addressText: { flex: 1, color: '#6d28d9', fontSize: 12 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  driverText: { color: '#6b7280', fontSize: 12 },
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
  readyBtn: { backgroundColor: '#10b981' },
  outForDeliveryBtn: { backgroundColor: '#7c3aed' },
  deliveredBtn: { backgroundColor: '#16a34a' },
});
