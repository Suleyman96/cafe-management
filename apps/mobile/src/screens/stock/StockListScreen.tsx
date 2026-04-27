import type { StockItem, StockItemInsert, StockItemUpdate } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, FAB, Modal, Portal, Searchbar } from 'react-native-paper';
import { StockItemCard } from '@/components/stock/StockItemCard';
import { StockItemModal } from '@/components/stock/StockItemModal';
import { StockMovementModal } from '@/components/stock/StockMovementModal';
import { ConfirmDialog, EmptyState, ErrorScreen, LoadingScreen } from '@/components/ui';
import {
  useAdjustStock,
  useCreateStockItem,
  useCurrencySymbol,
  useDeleteStockItem,
  useLowStockCount,
  useStockItems,
  useStockMovements,
  useStockTotalValue,
  useUpdateStockItem,
} from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';
import { Text } from '@/lib/paper-compat';
import { useAuthStore } from '@/store/auth-store';
import { BRAND_PRIMARY, COLORS } from '@/theme';

export default function StockListScreen() {
  const staff = useAuthStore((s) => s.staff);
  const { showSuccess, showError } = useSnackbar();
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();

  // Modal state
  const [showItemModal, setShowItemModal] = useState(false);
  const [editItem, setEditItem] = useState<StockItem | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [movementItem, setMovementItem] = useState<StockItem | null>(null);
  const [movementType, setMovementType] = useState<'in' | 'out'>('in');
  const [historyItemId, setHistoryItemId] = useState<string | undefined>();

  const { data: items, isLoading, error, refetch } = useStockItems();
  const { data: lowCount } = useLowStockCount();
  const { data: totalValue } = useStockTotalValue();
  const { data: movements } = useStockMovements(historyItemId);
  const adjustStock = useAdjustStock();
  const createItem = useCreateStockItem();
  const updateItem = useUpdateStockItem();
  const deleteItem = useDeleteStockItem();

  const currencySymbol = useCurrencySymbol();

  // Filter by search + category
  const filtered = useMemo(() => {
    let result = items || [];
    if (categoryFilter) {
      result = result.filter((i) => i.category === categoryFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
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
      if (item.category) cats.add(item.category);
    }
    return Array.from(cats).sort();
  }, [items]);

  const handleItemSubmit = async (data: Record<string, string | number | boolean | null>) => {
    try {
      if (editItem) {
        await updateItem.mutateAsync({ id: editItem.id, data: data as unknown as StockItemUpdate });
        showSuccess(t('stock.itemUpdated'));
      } else {
        await createItem.mutateAsync(data as unknown as StockItemInsert);
        showSuccess(t('stock.itemCreated'));
      }
      setShowItemModal(false);
      setEditItem(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('stock.failedSave'));
    }
  };

  const handleEdit = (id: string) => {
    const item = items?.find((i) => i.id === id);
    if (item) {
      setEditItem(item);
      setShowItemModal(true);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteItemId) return;
    try {
      await deleteItem.mutateAsync(deleteItemId);
      showSuccess(t('stock.itemDeleted'));
      setDeleteItemId(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('stock.failedDelete'));
    }
  };

  const handleOpenMovement = (id: string, type: 'in' | 'out') => {
    const item = items?.find((i) => i.id === id);
    if (item) {
      setMovementType(type);
      setMovementItem(item);
    }
  };

  const handleMovementSubmit = async (data: {
    type: 'in' | 'out' | 'adjustment';
    quantity: number;
    reason?: string;
  }) => {
    if (!movementItem) return;
    if (!staff?.id) {
      showError(t('payment.notAuthenticated'));
      return;
    }
    try {
      await adjustStock.mutateAsync({
        id: movementItem.id,
        data: { ...data, performedBy: staff.id },
      });
      showSuccess(t('stock.stockAdjusted'));
      setMovementItem(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('stock.failedAdjust'));
    }
  };

  if (isLoading) return <LoadingScreen message={t('stock.loadingStock')} />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      {/* Summary */}
      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text variant="bodySmall" style={styles.muted}>
              {tCommon('items')}
            </Text>
            <Text variant="titleMedium" style={styles.itemsValue}>
              {(items || []).length}
            </Text>
          </Card.Content>
        </Card>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text variant="bodySmall" style={styles.muted}>
              {t('stock.lowStock')}
            </Text>
            <Text variant="titleMedium" style={styles.lowValue}>
              {lowCount || 0}
            </Text>
          </Card.Content>
        </Card>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text variant="bodySmall" style={styles.muted}>
              {t('stock.value')}
            </Text>
            <Text variant="titleMedium" style={styles.valueValue}>
              {currencySymbol}
              {(totalValue || 0).toFixed(0)}
            </Text>
          </Card.Content>
        </Card>
      </View>

      <Searchbar
        placeholder={t('stock.searchItems')}
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
          {tCommon('all')} ({(items || []).length})
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
        {t('stock.itemCount', { count: filtered.length })}
        {search ? ` ${t('stock.forSearch', { query: search })}` : ''}
      </Text>

      <FlashList
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
            title={t('stock.noStockItems')}
            description={search ? t('stock.tryDifferentSearch') : t('stock.addFirstItem')}
          />
        }
        contentContainerStyle={styles.list}
      />

      <FAB
        icon="plus"
        label={t('stock.addItem')}
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
        initialType={movementType}
        item={movementItem ?? undefined}
      />

      {/* History Modal */}
      <Portal>
        <Modal
          visible={!!historyItemId}
          onDismiss={() => setHistoryItemId(undefined)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>
            {t('stock.movementHistory')}
          </Text>
          {(movements || []).length === 0 ? (
            <Text style={styles.muted}>{t('stock.noMovements')}</Text>
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
                          color:
                            m.movement_type === 'adjustment'
                              ? BRAND_PRIMARY
                              : m.quantity_change >= 0
                                ? COLORS.success
                                : COLORS.danger,
                          fontWeight: '600',
                        }}
                      >
                        {m.quantity_change >= 0 ? '+' : ''}
                        {m.quantity_change}
                      </Text>
                      <Text variant="bodySmall" style={styles.historyType}>
                        {m.movement_type === 'in'
                          ? t('stock.addStockLabel')
                          : m.movement_type === 'out'
                            ? t('stock.removeStockLabel')
                            : t('stock.adjustment')}
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
            {tCommon('close')}
          </Button>
        </Modal>
      </Portal>

      <ConfirmDialog
        visible={!!deleteItemId}
        title={t('stock.deleteStockItem')}
        message={t('stock.deleteStockConfirm')}
        onConfirm={handleDeleteItem}
        onCancel={() => setDeleteItemId(null)}
        destructive
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginVertical: 8 },
  summaryCard: { flex: 1 },
  itemsValue: { fontWeight: '700', color: COLORS.textPrimary },
  lowValue: { fontWeight: '700', color: COLORS.danger },
  valueValue: { fontWeight: '700', color: COLORS.success },
  search: { marginHorizontal: 16, marginBottom: 8 },
  filterChips: { paddingHorizontal: 16, gap: 6, paddingBottom: 8 },
  countText: { color: COLORS.textLight, paddingHorizontal: 16, marginBottom: 4 },
  list: { paddingTop: 4, paddingBottom: 80 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  modal: {
    backgroundColor: COLORS.card,
    margin: 20,
    padding: 20,
    borderRadius: 12,
    maxHeight: '80%',
  },
  modalTitle: { fontWeight: '700', marginBottom: 12 },
  muted: { color: COLORS.textMuted },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  historyInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyType: { color: COLORS.textLight, fontSize: 11, textTransform: 'capitalize' },
  historyMeta: { alignItems: 'flex-end', gap: 2, flex: 1, marginLeft: 12 },
  historyDate: { color: COLORS.textLight, fontSize: 11 },
  closeBtn: { marginTop: 12 },
});
