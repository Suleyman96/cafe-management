import { ORDER_STATUS } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBadge, TimeElapsed } from '@/components/ui';
import { BRAND_PRIMARY, COLORS, ORDER_STATUS_COLORS } from '@/theme';

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
  onMarkAllServed: (orderId: string) => void;
  isProcessing?: boolean;
}

export const KitchenOrderCard = React.memo(function KitchenOrderCard({
  order,
  onStartPreparing,
  onMarkItemReady,
  onMarkAllReady,
  onMarkAllServed,
  isProcessing = false,
}: KitchenOrderCardProps) {
  const { t } = useTranslation('staff');

  const activeItems =
    order.order_items?.filter((i) => i.status !== 'served' && i.status !== 'cancelled') || [];

  const allItemsReady = activeItems.length > 0 && activeItems.every((i) => i.status === 'ready');

  const borderColor = ORDER_STATUS_COLORS[order.status]?.text || BRAND_PRIMARY;

  const tableLabel = order.table
    ? t('kitchen.tableNumber', { number: order.table.table_number })
    : order.order_type === 'takeout'
      ? t('kitchen.takeout')
      : order.order_type === 'delivery'
        ? t('kitchen.delivery')
        : '—';

  return (
    <View style={[styles.card, { borderColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.orderNumber}>#{order.order_number || '—'}</Text>
          <View style={styles.tablePill}>
            <Text style={styles.tablePillText}>{tableLabel}</Text>
          </View>
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
              <Text style={styles.itemName}>
                {item.quantity}x {item.menu_item?.name || t('kitchen.unknownItem')}
              </Text>
              {item.notes && <Text style={styles.itemNotes}>{item.notes}</Text>}
            </View>
            {(item.status === 'pending' || item.status === 'preparing') && (
              <TouchableOpacity
                style={styles.itemReadyBtn}
                onPress={() => onMarkItemReady(item.id)}
                disabled={isProcessing}
                activeOpacity={0.7}
              >
                <Text style={styles.itemReadyBtnText}>{t('kitchen.ready')}</Text>
              </TouchableOpacity>
            )}
            {item.status === 'ready' && (
              <View style={styles.readyPill}>
                <Text style={styles.readyPillText}>{t('kitchen.ready')}</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {order.status === ORDER_STATUS.NEW && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.warning }]}
            onPress={() => onStartPreparing(order.id)}
            disabled={isProcessing}
            activeOpacity={0.7}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={[styles.actionBtnText, { color: '#000' }]}>
                {t('kitchen.startPreparing')}
              </Text>
            )}
          </TouchableOpacity>
        )}
        {order.status === ORDER_STATUS.PREPARING && allItemsReady && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.success }]}
            onPress={() => onMarkAllReady(order.id)}
            disabled={isProcessing}
            activeOpacity={0.7}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>{t('kitchen.allReady')}</Text>
            )}
          </TouchableOpacity>
        )}
        {order.status === ORDER_STATUS.READY && order.order_type !== 'delivery' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#8b5cf6' }]}
            onPress={() => onMarkAllServed(order.id)}
            disabled={isProcessing}
            activeOpacity={0.7}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>{t('kitchen.allServed')}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginBottom: 10,
    backgroundColor: '#262626',
    borderWidth: 3,
    borderRadius: 12,
    padding: 14,
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
    fontSize: 18,
  },
  tablePill: {
    backgroundColor: '#404040',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tablePillText: {
    color: '#d1d5db',
    fontSize: 11,
    fontWeight: '600',
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
    fontSize: 14,
  },
  itemNotes: {
    color: COLORS.warning,
    fontStyle: 'italic',
    fontSize: 12,
  },
  itemReadyBtn: {
    backgroundColor: COLORS.success,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  itemReadyBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  readyPill: {
    backgroundColor: COLORS.success,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  readyPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  actions: {
    marginTop: 12,
    gap: 8,
  },
  actionBtn: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
