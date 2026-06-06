import { useTranslation } from '@gustri/i18n';
import type { HiddenCategoryBucket } from '@gustri/queries';
import { StatusBadge, TimeElapsed } from '@gustri/ui-mobile';
import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { CARD_PADDING, CARD_RADIUS } from '@/theme';
import { HiddenItemsSummary } from './HiddenItemsSummary';
import { KitchenOrderActions } from './KitchenOrderActions';
import { type KitchenItem, KitchenOrderItemRow } from './KitchenOrderItemRow';
import { useKitchenUrgency } from './use-kitchen-urgency';

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

  const { urgency, pulseOpacity } = useKitchenUrgency({
    status: order.status,
    createdAt: order.created_at,
    allItemsReady,
  });

  const tableLabel = order.table
    ? t('kitchen.tableNumber', { number: order.table.table_number })
    : order.order_type === 'takeout'
      ? t('kitchen.takeout')
      : order.order_type === 'delivery'
        ? t('kitchen.delivery')
        : '—';

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: urgency.bg, borderColor: urgency.border, opacity: pulseOpacity },
      ]}
    >
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
      <KitchenOrderActions
        orderId={order.id}
        status={order.status}
        orderType={order.order_type}
        allItemsReady={allItemsReady}
        isProcessing={isProcessing}
        onStartPreparing={onStartPreparing}
        onMarkAllReady={onMarkAllReady}
        onMarkAllServed={onMarkAllServed}
      />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginBottom: 10,
    // backgroundColor + borderColor are set inline from `urgency` so each
    // card paints its own elapsed-time band; the static fields below
    // define the geometry only.
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
    fontWeight: '900',
    color: '#fff',
    fontSize: 28,
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
});
