import { ORDER_STATUS } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import type { HiddenCategoryBucket } from '@gustri/queries';
import { useIsMutating } from '@tanstack/react-query';
import React, { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBadge, TimeElapsed } from '@/components/ui';
import { MUTATION_KEYS } from '@/lib/mutation-keys';
import { BRAND_PRIMARY, CARD_PADDING, CARD_RADIUS, COLORS, ORDER_STATUS_COLORS } from '@/theme';
import { HiddenItemsSummary } from './HiddenItemsSummary';

type KitchenItem = {
  id: string;
  quantity: number;
  status: string;
  notes?: string | null;
  menu_item?: { name?: string | null } | null;
};

interface KitchenOrderCardProps {
  order: {
    id: string;
    order_number?: string | null;
    status: string;
    created_at: string;
    order_type?: string | null;
    table?: { table_number: string } | null;
    /**
     * Items the local kitchen station should render. The screen passes
     * `visibleItems` from `deriveKitchenView` here — for unfiltered
     * stations this is the full set, for filtered stations it's the
     * subset matching the staff's category selection.
     */
    order_items?: Array<KitchenItem>;
  };
  /**
   * Hidden-item summary shown below the items list when at least one
   * item on the order belongs to another station.
   */
  hiddenCount?: number;
  hiddenByCategory?: HiddenCategoryBucket[];
  onStartPreparing: (orderId: string) => void;
  onMarkItemReady: (itemId: string) => void;
  onMarkAllReady: (orderId: string) => void;
  onMarkAllServed: (orderId: string) => void;
  isProcessing?: boolean;
}

interface KitchenOrderItemRowProps {
  item: KitchenItem;
  onMarkReady: (itemId: string) => void;
  isOrderProcessing: boolean;
}

const KitchenOrderItemRow = React.memo(function KitchenOrderItemRow({
  item,
  onMarkReady,
  isOrderProcessing,
}: KitchenOrderItemRowProps) {
  const { t } = useTranslation('staff');

  // H2: per-item disable is read from the mutation cache, not from parent
  // state. The cache is the same store the mutation lifecycle writes to,
  // so a same-tick double-tap on this row sees the in-flight mutation
  // without a parent re-render in the loop. The predicate scopes the
  // count to mutations whose `variables.itemId` targets *this* row, so
  // a different item's mutation doesn't lock this one. Auto-clears on
  // settle — no try/finally bookkeeping in the screen.
  const matchesItem = useCallback(
    (m: { state: { variables: unknown } }) => {
      const vars = m.state.variables as { itemId?: string } | undefined;
      return vars?.itemId === item.id;
    },
    [item.id],
  );
  const itemMutating =
    useIsMutating({
      mutationKey: MUTATION_KEYS.UPDATE_ORDER_ITEM_STATUS,
      predicate: matchesItem,
    }) > 0;

  // `isOrderProcessing` covers bulk order-level operations (Start Preparing /
  // All Ready / All Served) where every active item is being mutated; those
  // flows don't enter `useIsMutating`'s per-item scope through the same
  // gateway, so we keep this gate as the bulk-op safety net.
  const itemDisabled = isOrderProcessing || itemMutating;

  return (
    <View style={styles.itemRow}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>
          {item.quantity}x {item.menu_item?.name || t('kitchen.unknownItem')}
        </Text>
        {item.notes && <Text style={styles.itemNotes}>{item.notes}</Text>}
      </View>
      {(item.status === 'pending' || item.status === 'preparing') && (
        <TouchableOpacity
          style={styles.itemReadyBtn}
          onPress={() => onMarkReady(item.id)}
          disabled={itemDisabled}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`${t('kitchen.ready')} — ${item.menu_item?.name || t('kitchen.unknownItem')}`}
          accessibilityState={{ disabled: itemDisabled }}
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
  );
});

export const KitchenOrderCard = React.memo(function KitchenOrderCard({
  order,
  hiddenCount = 0,
  hiddenByCategory,
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
          <KitchenOrderItemRow
            key={item.id}
            item={item}
            onMarkReady={onMarkItemReady}
            isOrderProcessing={isProcessing}
          />
        ))}
      </View>

      {/* Hidden-station coordination summary */}
      <HiddenItemsSummary count={hiddenCount} byCategory={hiddenByCategory ?? []} />

      {/* Actions */}
      <View style={styles.actions}>
        {order.status === ORDER_STATUS.NEW && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.warning }]}
            onPress={() => onStartPreparing(order.id)}
            disabled={isProcessing}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('kitchen.startPreparing')}
            accessibilityState={{ disabled: isProcessing, busy: isProcessing }}
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
            accessibilityRole="button"
            accessibilityLabel={t('kitchen.allReady')}
            accessibilityState={{ disabled: isProcessing, busy: isProcessing }}
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
            accessibilityRole="button"
            accessibilityLabel={t('kitchen.allServed')}
            accessibilityState={{ disabled: isProcessing, busy: isProcessing }}
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
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
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
