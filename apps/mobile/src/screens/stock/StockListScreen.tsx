import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, FAB, Modal, Portal, Searchbar, Text } from 'react-native-paper';
import { StockItemCard } from '@/components/stock/StockItemCard';
import { StockItemModal } from '@/components/stock/StockItemModal';
import { StockMovementModal } from '@/components/stock/StockMovementModal';
import { ConfirmDialog, EmptyState, ErrorScreen, LoadingScreen } from '@/components/ui';
import {
  useAdjustStock,
  useCafeSettings,
  useCreateStockItem,
  useDeleteStockItem,
  useLowStockCount,
  useStockItems,
  useStockMovements,
  useStockTotalValue,
  useUpdateStockItem,
} from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';
import { useAuthStore } from '@/store/auth-store';

export default function StockListScreen() {
  const staff = useAuthStore((s) => s.staff);
  const { showSuccess, showError } = useSnackbar();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();

  // Modal state
  const [showItemModal, setShowItemModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [movementItem, setMovementItem] = useState<any>(null);
  const [historyItemId, setHistoryItemId] = useState<string | undefined>();

  const { data: items, isLoading, error, refetch } = useStockItems();
  const { data: lowCount } = useLowStockCount();
  const { data: totalValue } = useStockTotalValue();
  const { data: settings } = useCafeSettings();
  const { data: movements } = useStockMovements(historyItemId);
  const adjustStock = useAdjustStock();
  const createItem = useCreateStockItem();
  const updateItem = useUpdateStockItem();
  const deleteItem = useDeleteStockItem();

  const currencySymbol = settings?.currency_symbol || '$';

  // Filter by search + category
  const filtered = useMemo(() => {
    let result = items || [];
    if (categoryFilter) {
      result = result.filter((i: any) => i.category === categoryFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (i: any) =>
          i.name?.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q) ||
          i.supplier_name?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [items, search, categoryFilter]);

  // Unique categories from data
  const usedCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const item of items || []) {
      if ((item as any).category) cats.add((item as any).category);
    }
    return Array.from(cats).sort();
  }, [items]);

  const handleItemSubmit = async (data: any) => {
    try {
      if (editItem) {
        await updateItem.mutateAsync({ id: editItem.id, data });
        showSuccess('Item updated');
      } else {
        await createItem.mutateAsync(data);
        showSuccess('Item created');
      }
      setShowItemModal(false);
      setEditItem(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to save item');
    }
  };

  const handleEdit = (id: string) => {
    const item = items?.find((i: any) => i.id === id);
    if (item) {
      setEditItem(item);
      setShowItemModal(true);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteItemId) return;
    try {
      await deleteItem.mutateAsync(deleteItemId);
      showSuccess('Item deleted');
      setDeleteItemId(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleOpenMovement = (id: string, _type: 'in' | 'out') => {
    const item = items?.find((i: any) => i.id === id);
    if (item) {
      setMovementItem(item);
    }
  };

  const handleMovementSubmit = async (data: {
    type: 'in' | 'out' | 'adjustment';
    quantity: number;
    reason?: string;
  }) => {
    if (!movementItem) return;
    try {
      await adjustStock.mutateAsync({
        id: movementItem.id,
        data: { ...data, performedBy: staff?.id },
      });
      showSuccess('Stock adjusted');
      setMovementItem(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to adjust stock');
    }
  };

  if (isLoading) return <LoadingScreen message="Loading stock..." />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      {/* Summary */}
      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text variant="bodySmall" style={styles.muted}>
              Items
            </Text>
            <Text variant="titleMedium" style={styles.itemsValue}>
              {(items || []).length}
            </Text>
          </Card.Content>
        </Card>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text variant="bodySmall" style={styles.muted}>
              Low Stock
            </Text>
            <Text variant="titleMedium" style={styles.lowValue}>
              {lowCount || 0}
            </Text>
          </Card.Content>
        </Card>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text variant="bodySmall" style={styles.muted}>
              Value
            </Text>
            <Text variant="titleMedium" style={styles.valueValue}>
              {currencySymbol}
              {(totalValue || 0).toFixed(0)}
            </Text>
          </Card.Content>
        </Card>
      </View>

      <Searchbar
        placeholder="Search items..."
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterChips}
      >
        <Chip compact selected={!categoryFilter} onPress={() => setCategoryFilter(undefined)}>
          All ({(items || []).length})
        </Chip>
        {usedCategories.map((cat) => (
          <Chip
            key={cat}
            compact
            selected={categoryFilter === cat}
            onPress={() => setCategoryFilter(categoryFilter === cat ? undefined : cat)}
          >
            {cat}
          </Chip>
        ))}
      </ScrollView>

      {/* Count */}
      <Text variant="bodySmall" style={styles.countText}>
        {filtered.length} item{filtered.length !== 1 ? 's' : ''}
        {search ? ` for "${search}"` : ''}
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <StockItemCard
            item={item}
            currencySymbol={currencySymbol}
            onAddStock={(id) => handleOpenMovement(id, 'in')}
            onRemoveStock={(id) => handleOpenMovement(id, 'out')}
            onViewHistory={(id) => setHistoryItemId(historyItemId === id ? undefined : id)}
            onEdit={handleEdit}
            onDelete={(id) => setDeleteItemId(id)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="package-variant-closed"
            title="No stock items"
            description={search ? 'Try a different search' : 'Add your first stock item'}
          />
        }
        contentContainerStyle={styles.list}
      />

      <FAB
        icon="plus"
        label="Add Item"
        style={styles.fab}
        onPress={() => {
          setEditItem(null);
          setShowItemModal(true);
        }}
      />

      {/* Stock Item Create/Edit Modal */}
      <StockItemModal
        visible={showItemModal}
        onDismiss={() => {
          setShowItemModal(false);
          setEditItem(null);
        }}
        onSubmit={handleItemSubmit}
        loading={createItem.isPending || updateItem.isPending}
        initialData={editItem}
        currencySymbol={currencySymbol}
      />

      {/* Stock Movement Modal */}
      <StockMovementModal
        visible={!!movementItem}
        onDismiss={() => setMovementItem(null)}
        onSubmit={handleMovementSubmit}
        loading={adjustStock.isPending}
        item={movementItem}
      />

      {/* History Modal */}
      <Portal>
        <Modal
          visible={!!historyItemId}
          onDismiss={() => setHistoryItemId(undefined)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>
            Movement History
          </Text>
          {(movements || []).length === 0 ? (
            <Text style={styles.muted}>No movements recorded</Text>
          ) : (
            movements
              ?.slice(0, 20)
              .map(
                (m: {
                  id: string;
                  movement_type: string;
                  quantity_change: number;
                  reason: string | null;
                  created_at: string;
                  performed_by_staff?: { full_name: string } | null;
                }) => (
                  <View key={m.id} style={styles.historyRow}>
                    <View style={styles.historyInfo}>
                      <Text
                        variant="bodyMedium"
                        style={{
                          color: m.movement_type === 'in' ? '#10b981' : '#ef4444',
                          fontWeight: '600',
                        }}
                      >
                        {m.movement_type === 'in' ? '+' : '-'}
                        {m.quantity_change}
                      </Text>
                      <Text variant="bodySmall" style={styles.historyType}>
                        {m.movement_type}
                      </Text>
                    </View>
                    <View style={styles.historyMeta}>
                      {m.reason && (
                        <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
                          {m.reason}
                        </Text>
                      )}
                      <Text variant="bodySmall" style={styles.historyDate}>
                        {new Date(m.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                ),
              )
          )}
          <Button onPress={() => setHistoryItemId(undefined)} style={styles.closeBtn}>
            Close
          </Button>
        </Modal>
      </Portal>

      <ConfirmDialog
        visible={!!deleteItemId}
        title="Delete Stock Item"
        message="Are you sure you want to delete this stock item? Movement history will also be deleted."
        onConfirm={handleDeleteItem}
        onCancel={() => setDeleteItemId(null)}
        destructive
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginVertical: 8 },
  summaryCard: { flex: 1 },
  itemsValue: { fontWeight: '700', color: '#1e293b' },
  lowValue: { fontWeight: '700', color: '#ef4444' },
  valueValue: { fontWeight: '700', color: '#10b981' },
  search: { marginHorizontal: 16, marginBottom: 8 },
  filterChips: { paddingHorizontal: 16, gap: 6, paddingBottom: 8 },
  countText: { color: '#9ca3af', paddingHorizontal: 16, marginBottom: 4 },
  list: { paddingTop: 4, paddingBottom: 80 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  modal: { backgroundColor: '#fff', margin: 20, padding: 20, borderRadius: 12, maxHeight: '80%' },
  modalTitle: { fontWeight: '700', marginBottom: 12 },
  muted: { color: '#6b7280' },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  historyInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyType: { color: '#9ca3af', fontSize: 11, textTransform: 'capitalize' },
  historyMeta: { alignItems: 'flex-end', gap: 2, flex: 1, marginLeft: 12 },
  historyDate: { color: '#9ca3af', fontSize: 11 },
  closeBtn: { marginTop: 12 },
});
