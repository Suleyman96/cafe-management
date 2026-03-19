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

function formatLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const StatusBadge = React.memo(function StatusBadge({
  status,
  type = 'order',
}: StatusBadgeProps) {
  const colorMap = COLOR_MAPS[type] || ORDER_STATUS_COLORS;
  const backgroundColor = colorMap[status] || '#6b7280';

  return (
    <Chip
      compact
      textStyle={{ color: '#fff', fontSize: 11, fontWeight: '600' }}
      style={{ backgroundColor, alignSelf: 'flex-start' }}
    >
      {formatLabel(status)}
    </Chip>
  );
});
