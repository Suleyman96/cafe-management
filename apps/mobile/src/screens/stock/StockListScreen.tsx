import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Button, Card, FAB, Modal, Portal, Searchbar, Text } from 'react-native-paper';
import { StockItemCard } from '@/components/stock/StockItemCard';
import { EmptyState, ErrorScreen, LoadingScreen } from '@/components/ui';
import {
  useAdjustStock,
  useCafeSettings,
  useCreateStockItem,
  useLowStockCount,
  useStockItems,
  useStockMovements,
  useStockTotalValue,
} from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';
import { TextInput } from '@/lib/paper-compat';
import { useAuthStore } from '@/store/auth-store';

export default function StockListScreen() {
  const staff = useAuthStore((s) => s.staff);
  const { showSuccess, showError } = useSnackbar();
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [movementModal, setMovementModal] = useState<{ itemId: string; type: 'in' | 'out' } | null>(
    null,
  );
  const [historyItemId, setHistoryItemId] = useState<string | undefined>();

  const { data: items, isLoading, error, refetch } = useStockItems();
  const { data: lowCount } = useLowStockCount();
  const { data: totalValue } = useStockTotalValue();
  const { data: settings } = useCafeSettings();
  const { data: movements } = useStockMovements(historyItemId);
  const adjustStock = useAdjustStock();
  const createItem = useCreateStockItem();

  const currencySymbol = (settings as any)?.currency_symbol || '$';

  const filtered = (items || []).filter((i: any) =>
    i.name?.toLowerCase().includes(search.toLowerCase()),
  );

  // Create form
  const [newItem, setNewItem] = useState({
    name: '',
    category: '',
    unit: 'pcs',
    minimum_stock_level: '',
    cost_price: '',
  });

  // Movement form
  const [movementQty, setMovementQty] = useState('');
  const [movementReason, setMovementReason] = useState('');

  const handleCreate = async () => {
    try {
      await createItem.mutateAsync({
        name: newItem.name,
        category: newItem.category || undefined,
        unit: newItem.unit,
        minimum_stock_level: parseInt(newItem.minimum_stock_level, 10) || 0,
        cost_price: parseFloat(newItem.cost_price) || 0,
        quantity: 0,
      });
      showSuccess('Item created');
      setShowCreateModal(false);
      setNewItem({ name: '', category: '', unit: 'pcs', minimum_stock_level: '', cost_price: '' });
    } catch (err: any) {
      showError(err?.message || 'Failed to create item');
    }
  };

  const handleMovement = async () => {
    if (!movementModal) return;
    const qty = parseFloat(movementQty);
    if (Number.isNaN(qty) || qty <= 0) {
      showError('Enter a valid quantity');
      return;
    }

    try {
      await adjustStock.mutateAsync({
        id: movementModal.itemId,
        data: {
          type: movementModal.type,
          quantity: qty,
          reason: movementReason || undefined,
          performedBy: staff?.id,
        },
      });
      showSuccess(`Stock ${movementModal.type === 'in' ? 'added' : 'removed'}`);
      setMovementModal(null);
      setMovementQty('');
      setMovementReason('');
    } catch (err: any) {
      showError(err?.message || 'Failed to adjust stock');
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
            <Text variant="titleMedium" style={{ fontWeight: '700' }}>
              {(items || []).length}
            </Text>
          </Card.Content>
        </Card>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text variant="bodySmall" style={styles.muted}>
              Low Stock
            </Text>
            <Text variant="titleMedium" style={{ fontWeight: '700', color: '#ef4444' }}>
              {lowCount || 0}
            </Text>
          </Card.Content>
        </Card>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text variant="bodySmall" style={styles.muted}>
              Value
            </Text>
            <Text variant="titleMedium" style={{ fontWeight: '700' }}>
              {currencySymbol}
              {((totalValue as any) || 0).toFixed(0)}
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

      <FlatList
        data={filtered}
        keyExtractor={(item: any) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <StockItemCard
            item={item}
            currencySymbol={currencySymbol}
            onAddStock={(id) => setMovementModal({ itemId: id, type: 'in' })}
            onRemoveStock={(id) => setMovementModal({ itemId: id, type: 'out' })}
            onViewHistory={(id) => setHistoryItemId(historyItemId === id ? undefined : id)}
          />
        )}
        ListEmptyComponent={<EmptyState icon="package-variant-closed" title="No stock items" />}
        contentContainerStyle={styles.list}
      />

      <FAB icon="plus" style={styles.fab} onPress={() => setShowCreateModal(true)} />

      {/* Create Modal */}
      <Portal>
        <Modal
          visible={showCreateModal}
          onDismiss={() => setShowCreateModal(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 12 }}>
            New Stock Item
          </Text>
          <TextInput
            label="Name"
            value={newItem.name}
            onChangeText={(v: string) => setNewItem({ ...newItem, name: v })}
            mode="outlined"
            dense
            style={styles.input}
          />
          <TextInput
            label="Category"
            value={newItem.category}
            onChangeText={(v: string) => setNewItem({ ...newItem, category: v })}
            mode="outlined"
            dense
            style={styles.input}
          />
          <TextInput
            label="Unit"
            value={newItem.unit}
            onChangeText={(v: string) => setNewItem({ ...newItem, unit: v })}
            mode="outlined"
            dense
            style={styles.input}
          />
          <TextInput
            label="Minimum Stock Level"
            value={newItem.minimum_stock_level}
            onChangeText={(v: string) => setNewItem({ ...newItem, minimum_stock_level: v })}
            mode="outlined"
            keyboardType="number-pad"
            dense
            style={styles.input}
          />
          <TextInput
            label="Cost Price"
            value={newItem.cost_price}
            onChangeText={(v: string) => setNewItem({ ...newItem, cost_price: v })}
            mode="outlined"
            keyboardType="decimal-pad"
            dense
            style={styles.input}
          />
          <View style={styles.modalActions}>
            <Button onPress={() => setShowCreateModal(false)}>Cancel</Button>
            <Button
              mode="contained"
              onPress={handleCreate}
              loading={createItem.isPending}
              disabled={!newItem.name.trim()}
            >
              Create
            </Button>
          </View>
        </Modal>

        {/* Movement Modal */}
        <Modal
          visible={!!movementModal}
          onDismiss={() => setMovementModal(null)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 12 }}>
            {movementModal?.type === 'in' ? 'Add Stock' : 'Remove Stock'}
          </Text>
          <TextInput
            label="Quantity"
            value={movementQty}
            onChangeText={setMovementQty}
            mode="outlined"
            keyboardType="decimal-pad"
            dense
            style={styles.input}
          />
          <TextInput
            label="Reason (optional)"
            value={movementReason}
            onChangeText={setMovementReason}
            mode="outlined"
            dense
            style={styles.input}
          />
          <View style={styles.modalActions}>
            <Button onPress={() => setMovementModal(null)}>Cancel</Button>
            <Button mode="contained" onPress={handleMovement} loading={adjustStock.isPending}>
              Confirm
            </Button>
          </View>
        </Modal>

        {/* History Modal */}
        <Modal
          visible={!!historyItemId}
          onDismiss={() => setHistoryItemId(undefined)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 12 }}>
            Movement History
          </Text>
          {(movements || []).length === 0 ? (
            <Text style={styles.muted}>No movements recorded</Text>
          ) : (
            (movements as any[])?.slice(0, 20).map((m: any) => (
              <View key={m.id} style={styles.historyRow}>
                <View>
                  <Text variant="bodyMedium">
                    {m.type === 'in' ? '+' : '-'}
                    {m.quantity} ({m.type})
                  </Text>
                  {m.reason && (
                    <Text variant="bodySmall" style={styles.muted}>
                      {m.reason}
                    </Text>
                  )}
                </View>
                <Text variant="bodySmall" style={styles.muted}>
                  {new Date(m.created_at).toLocaleDateString()}
                </Text>
              </View>
            ))
          )}
          <Button onPress={() => setHistoryItemId(undefined)} style={{ marginTop: 8 }}>
            Close
          </Button>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginVertical: 8 },
  summaryCard: { flex: 1 },
  search: { marginHorizontal: 16, marginBottom: 8 },
  list: { paddingTop: 4, paddingBottom: 80 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  modal: { backgroundColor: '#fff', margin: 20, padding: 20, borderRadius: 12, maxHeight: '80%' },
  input: { marginBottom: 8 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  muted: { color: '#6b7280' },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
});
