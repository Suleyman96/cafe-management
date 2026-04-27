import { useTranslation } from '@gustri/i18n';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ColorPair } from '@/theme';
import { ORDER_STATUS_COLORS, TABLE_STATUS_COLORS, WAITER_CALL_REASON_COLORS } from '@/theme';

interface StatusBadgeProps {
  status: string;
  type?: 'order' | 'table' | 'waiterCall' | 'orderItem';
}

const FALLBACK_COLOR: ColorPair = { bg: '#f3f4f6', text: '#374151' };

const PAIR_MAPS: Record<string, Record<string, ColorPair>> = {
  order: ORDER_STATUS_COLORS,
  table: TABLE_STATUS_COLORS,
  orderItem: ORDER_STATUS_COLORS,
};

/** Waiter-call reasons use solid colors — wrap them into ColorPair (solid bg + white text) */
function getColorPair(type: string, status: string): ColorPair {
  if (type === 'waiterCall') {
    const solid = WAITER_CALL_REASON_COLORS[status];
    return solid ? { bg: solid, text: '#fff' } : FALLBACK_COLOR;
  }
  return PAIR_MAPS[type]?.[status] || FALLBACK_COLOR;
}

const STATUS_LABEL_KEYS: Record<string, Record<string, string>> = {
  order: {
    pending_approval: 'orders.pendingApproval',
    new: 'orders.new',
    preparing: 'orders.preparing',
    ready: 'orders.ready',
    served: 'orders.served',
    out_for_delivery: 'orders.outForDelivery',
    delivered: 'orders.delivered',
    closed: 'orders.closed',
    cancelled: 'orders.cancelled',
    paid: 'orders.paid',
  },
  table: {
    free: 'tables.free',
    occupied: 'tables.occupied',
    reserved: 'tables.reserved',
    closed: 'tables.closed',
  },
  waiterCall: {
    assistance: 'calls.assistance',
    bill: 'calls.requestBill',
    complaint: 'calls.complaint',
    question: 'calls.question',
    emergency: 'calls.emergency',
    pending: 'orders.pending',
    acknowledged: 'calls.acknowledged',
    resolved: 'calls.resolved',
  },
  orderItem: {
    pending: 'orders.pending',
    preparing: 'orders.preparing',
    ready: 'orders.ready',
    served: 'orders.served',
    cancelled: 'orders.cancelled',
  },
};

function formatLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const StatusBadge = React.memo(function StatusBadge({
  status,
  type = 'order',
}: StatusBadgeProps) {
  const { t } = useTranslation('staff');
  const colors = getColorPair(type, status);

  const labelKey = STATUS_LABEL_KEYS[type]?.[status];
  const label = labelKey ? t(labelKey) : formatLabel(status);

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
