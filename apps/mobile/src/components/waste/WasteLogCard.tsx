import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, Text } from 'react-native-paper';

const REASON_COLORS: Record<string, string> = {
  expired: '#ef4444',
  spoiled: '#dc2626',
  overcooked: '#f59e0b',
  dropped: '#8b5cf6',
  returned_by_customer: '#3b82f6',
  preparation_waste: '#6b7280',
  other: '#9ca3af',
};

interface WasteLogCardProps {
  log: {
    id: string;
    quantity: number;
    unit?: string | null;
    cost?: number | null;
    reason?: string | null;
    notes?: string | null;
    created_at: string;
    stock_item?: { name: string } | null;
    staff?: { full_name: string } | null;
  };
  currencySymbol?: string;
}

export const WasteLogCard = React.memo(function WasteLogCard({
  log,
  currencySymbol = '$',
}: WasteLogCardProps) {
  const reason = log.reason || 'other';
  const reasonColor = REASON_COLORS[reason] || '#9ca3af';
  const reasonLabel = reason.replace(/_/g, ' ');

  return (
    <Card style={styles.card}>
      <Card.Content style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.itemInfo}>
            <Text variant="titleSmall" style={styles.itemName}>
              {log.stock_item?.name || 'Unknown Item'}
            </Text>
            <Text variant="bodySmall" style={styles.muted}>
              {log.quantity} {log.unit || 'units'}
            </Text>
          </View>
          <Text variant="titleSmall" style={styles.cost}>
            {currencySymbol}
            {(log.cost || 0).toFixed(2)}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <Chip
            compact
            style={[styles.reasonChip, { backgroundColor: reasonColor }]}
            textStyle={{ color: '#fff', fontSize: 10, fontWeight: '600' }}
          >
            {reasonLabel.charAt(0).toUpperCase() + reasonLabel.slice(1)}
          </Chip>
          <Text variant="bodySmall" style={styles.muted}>
            {log.staff?.full_name || '—'} · {new Date(log.created_at).toLocaleDateString()}
          </Text>
        </View>

        {log.notes && (
          <Text variant="bodySmall" style={styles.notes}>
            {log.notes}
          </Text>
        )}
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  content: {
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontWeight: '600',
    color: '#1e293b',
  },
  cost: {
    color: '#ef4444',
    fontWeight: '700',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reasonChip: {
    alignSelf: 'flex-start',
  },
  muted: {
    color: '#6b7280',
  },
  notes: {
    color: '#6b7280',
    fontStyle: 'italic',
  },
});
