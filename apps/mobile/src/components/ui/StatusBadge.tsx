import { useTranslation } from '@gustri/i18n';
import React from 'react';
import { Chip } from 'react-native-paper';
import { ORDER_STATUS_COLORS, TABLE_STATUS_COLORS, WAITER_CALL_REASON_COLORS } from '@/theme';

interface StatusBadgeProps {
  status: string;
  type?: 'order' | 'table' | 'waiterCall' | 'orderItem';
}

const COLOR_MAPS: Record<string, Record<string, string>> = {
  order: ORDER_STATUS_COLORS,
  table: TABLE_STATUS_COLORS,
  waiterCall: WAITER_CALL_REASON_COLORS,
  orderItem: ORDER_STATUS_COLORS,
};

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
  const colorMap = COLOR_MAPS[type] || ORDER_STATUS_COLORS;
  const backgroundColor = colorMap[status] || '#6b7280';

  const labelKey = STATUS_LABEL_KEYS[type]?.[status];
  const label = labelKey ? t(labelKey) : formatLabel(status);

  return (
    <Chip
      compact
      textStyle={{ color: '#fff', fontSize: 11, fontWeight: '600' }}
      style={{ backgroundColor, alignSelf: 'flex-start' }}
    >
      {label}
    </Chip>
  );
});
