import { useTranslation } from '@gustri/i18n';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, IconButton } from 'react-native-paper';
import { Text } from '@/lib/paper-compat';

interface StockItemCardProps {
  item: {
    id: string;
    name: string;
    description?: string | null;
    category?: string | null;
    quantity: number;
    unit?: string | null;
    minimum_stock_level?: number | null;
    cost_price?: number | null;
    supplier_name?: string | null;
    notes?: string | null;
  };
  currencySymbol: string;
  onAddStock: (id: string) => void;
  onRemoveStock: (id: string) => void;
  onViewHistory: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const StockItemCard = React.memo(function StockItemCard({
  item,
  currencySymbol,
  onAddStock,
  onRemoveStock,
  onViewHistory,
  onEdit,
  onDelete,
}: StockItemCardProps) {
  const { t } = useTranslation('staff');
  const minLevel = item.minimum_stock_level || 0;
  const isLow = item.quantity <= minLevel && minLevel > 0;
  const isNearLow = !isLow && item.quantity <= minLevel * 1.5 && minLevel > 0;
  const qtyColor = isLow ? '#ef4444' : isNearLow ? '#f59e0b' : '#10b981';
  const unit = item.unit || 'units';

  return (
    <Card style={[styles.card, isLow && styles.lowStockCard]}>
      <Card.Content style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.itemInfo}>
            <View style={styles.nameRow}>
              <Text variant="titleSmall" style={styles.itemName}>
                {item.name}
              </Text>
              {isLow && (
                <Chip
                  compact
                  style={styles.lowBadge}
                  textStyle={{ color: '#fff', fontSize: 9, fontWeight: '700' }}
                >
                  {t('stock.low')}
                </Chip>
              )}
            </View>
            {item.category && (
              <Chip compact style={styles.categoryChip} textStyle={styles.categoryText}>
                {item.category}
              </Chip>
            )}
            {item.description && (
              <Text variant="bodySmall" style={styles.desc} numberOfLines={1}>
                {item.description}
              </Text>
            )}
          </View>
          <View style={styles.qtyArea}>
            <Text variant="headlineSmall" style={[styles.qty, { color: qtyColor }]}>
              {item.quantity}
            </Text>
            <Text variant="bodySmall" style={styles.muted}>
              {unit}
            </Text>
            <Text variant="bodySmall" style={styles.minLabel}>
              {t('stock.min')} {minLevel}
            </Text>
          </View>
        </View>

        {/* Details row */}
        <View style={styles.detailRow}>
          {item.cost_price != null && item.cost_price > 0 && (
            <Text variant="bodySmall" style={styles.detail}>
              {currencySymbol}
              {item.cost_price.toFixed(2)}/{unit}
            </Text>
          )}
          {item.supplier_name && (
            <Text variant="bodySmall" style={styles.detail}>
              {item.supplier_name}
            </Text>
          )}
        </View>

        {item.notes && (
          <Text variant="bodySmall" style={styles.notes} numberOfLines={1}>
            {item.notes}
          </Text>
        )}

        {/* Actions */}
        <View style={styles.separator} />
        <View style={styles.actionsRow}>
          <View style={styles.stockBtns}>
            <Button compact mode="contained-tonal" onPress={() => onAddStock(item.id)} icon="plus">
              {t('stock.add')}
            </Button>
            <Button
              compact
              mode="contained-tonal"
              onPress={() => onRemoveStock(item.id)}
              icon="minus"
            >
              {t('stock.remove')}
            </Button>
            <Button compact onPress={() => onViewHistory(item.id)} icon="history">
              {t('stock.history')}
            </Button>
          </View>
          <View style={styles.editBtns}>
            {onEdit && <IconButton icon="pencil" size={18} onPress={() => onEdit(item.id)} />}
            {onDelete && (
              <IconButton
                icon="delete"
                size={18}
                iconColor="#ef4444"
                onPress={() => onDelete(item.id)}
              />
            )}
          </View>
        </View>
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 8 },
  lowStockCard: { borderColor: '#fca5a5', borderWidth: 1 },
  content: { gap: 6 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemInfo: { flex: 1, gap: 3, marginRight: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemName: { fontWeight: '600', color: '#1e293b' },
  lowBadge: { backgroundColor: '#ef4444', height: 20 },
  categoryChip: { backgroundColor: '#f1f5f9', alignSelf: 'flex-start' },
  categoryText: { fontSize: 10, color: '#6b7280', fontWeight: '500' },
  desc: { color: '#6b7280' },
  qtyArea: { alignItems: 'flex-end' },
  qty: { fontWeight: '700', fontSize: 22 },
  muted: { color: '#6b7280' },
  minLabel: { color: '#9ca3af', fontSize: 10 },
  detailRow: { flexDirection: 'row', gap: 12 },
  detail: { color: '#6b7280', fontSize: 12 },
  notes: { color: '#9ca3af', fontStyle: 'italic', fontSize: 11 },
  separator: { height: 1, backgroundColor: '#f1f5f9', marginTop: 2 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stockBtns: { flexDirection: 'row', gap: 6, flex: 1 },
  editBtns: { flexDirection: 'row' },
});
