import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

interface StockItemCardProps {
  item: {
    id: string;
    name: string;
    category?: string | null;
    quantity: number;
    unit?: string | null;
    minimum_stock_level?: number | null;
    cost_price?: number | null;
    supplier?: string | null;
  };
  currencySymbol?: string;
  onAddStock: (id: string) => void;
  onRemoveStock: (id: string) => void;
  onViewHistory: (id: string) => void;
}

export const StockItemCard = React.memo(function StockItemCard({
  item,
  currencySymbol = '$',
  onAddStock,
  onRemoveStock,
  onViewHistory,
}: StockItemCardProps) {
  const minLevel = item.minimum_stock_level || 0;
  const isLow = item.quantity <= minLevel;
  const isNearLow = item.quantity <= minLevel * 1.5;
  const qtyColor = isLow ? '#ef4444' : isNearLow ? '#f59e0b' : '#10b981';

  return (
    <Card style={styles.card}>
      <Card.Content style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.itemInfo}>
            <Text variant="titleSmall" style={styles.itemName}>
              {item.name}
            </Text>
            {item.category && (
              <Text variant="bodySmall" style={styles.muted}>
                {item.category}
              </Text>
            )}
          </View>
          <View style={styles.qtyArea}>
            <Text variant="titleMedium" style={[styles.qty, { color: qtyColor }]}>
              {item.quantity}
            </Text>
            <Text variant="bodySmall" style={styles.muted}>
              {item.unit || 'units'} (min: {minLevel})
            </Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          {item.cost_price != null && (
            <Text variant="bodySmall" style={styles.muted}>
              Cost: {currencySymbol}
              {item.cost_price.toFixed(2)}/{item.unit || 'unit'}
            </Text>
          )}
          {item.supplier && (
            <Text variant="bodySmall" style={styles.muted}>
              Supplier: {item.supplier}
            </Text>
          )}
        </View>

        <View style={styles.actions}>
          <Button compact mode="contained-tonal" onPress={() => onAddStock(item.id)} icon="plus">
            Add
          </Button>
          <Button
            compact
            mode="contained-tonal"
            onPress={() => onRemoveStock(item.id)}
            icon="minus"
          >
            Remove
          </Button>
          <Button compact onPress={() => onViewHistory(item.id)} icon="history">
            History
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 8 },
  content: { gap: 8 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { fontWeight: '600', color: '#1e293b' },
  qtyArea: { alignItems: 'flex-end' },
  qty: { fontWeight: '700', fontSize: 20 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  muted: { color: '#6b7280' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
});
