import { formatSelectedOptions } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { useIsMutating } from '@tanstack/react-query';
import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MUTATION_KEYS } from '@/lib/mutation-keys';
import { COLORS } from '@/theme';

export type KitchenItem = {
  id: string;
  quantity: number;
  status: string;
  notes?: string | null;
  selected_options?: unknown;
  menu_item?: { name?: string | null } | null;
};

interface KitchenOrderItemRowProps {
  item: KitchenItem;
  onMarkReady: (itemId: string) => void;
  isOrderProcessing: boolean;
}

export const KitchenOrderItemRow = React.memo(function KitchenOrderItemRow({
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
        {formatSelectedOptions(item.selected_options) ? (
          <Text style={styles.itemNotes}>{formatSelectedOptions(item.selected_options)}</Text>
        ) : null}
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

const styles = StyleSheet.create({
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
});
