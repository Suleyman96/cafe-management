import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Chip, FAB, Searchbar } from 'react-native-paper';
import { MenuItemManageCard } from '@/components/menu-management/MenuItemManageCard';
import { MenuItemModal } from '@/components/menu-management/MenuItemModal';
import { ConfirmDialog, EmptyState, ErrorScreen, LoadingScreen } from '@/components/ui';
import { useCategories, useMenuItems } from '@/hooks';
import { useCafeSettings } from '@/hooks/use-cafe-settings';
import {
  useCreateMenuItem,
  useDeleteMenuItem,
  useToggleMenuItemAvailability,
  useUpdateMenuItem,
} from '@/hooks/use-menu-management';
import { useSnackbar } from '@/hooks/use-snackbar';

export default function MenuManagementScreen() {
  const { showSuccess, showError } = useSnackbar();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [showItemModal, setShowItemModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  const { data: items, isLoading, error, refetch } = useMenuItems({ categoryId: categoryFilter });
  const { data: categories } = useCategories();
  const { data: settings } = useCafeSettings();
  const createItem = useCreateMenuItem();
  const updateItem = useUpdateMenuItem();
  const deleteItem = useDeleteMenuItem();
  const toggleAvailability = useToggleMenuItemAvailability();

  const currencySymbol = settings?.currency_symbol || '$';

  const filtered = useMemo(() => {
    if (!items) return [];
    if (!search) return items;
    return items.filter((i: { name?: string }) =>
      (i.name || '').toLowerCase().includes(search.toLowerCase()),
    );
  }, [items, search]);

  const handleToggle = async (id: string) => {
    try {
      await toggleAvailability.mutateAsync(id);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to toggle');
    }
  };

  const handleEdit = (id: string) => {
    const item = items?.find((i: { id: string }) => i.id === id);
    if (item) {
      setEditItem(item);
      setShowItemModal(true);
    }
  };

  const handleSubmit = async (data: any) => {
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

  const handleDelete = async () => {
    if (!deleteItemId) return;
    try {
      await deleteItem.mutateAsync(deleteItemId);
      showSuccess('Item deleted');
      setDeleteItemId(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  if (isLoading) return <LoadingScreen message="Loading menu..." />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search menu items..."
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContent}
      >
        <Chip
          compact
          selected={!categoryFilter}
          onPress={() => setCategoryFilter(undefined)}
          style={styles.categoryChip}
        >
          All ({(items || []).length})
        </Chip>
        {(categories || []).map((c: { id: string; name: string }) => (
          <Chip
            key={c.id}
            compact
            selected={categoryFilter === c.id}
            onPress={() => setCategoryFilter(categoryFilter === c.id ? undefined : c.id)}
            style={styles.categoryChip}
          >
            {c.name || '--'}
          </Chip>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <MenuItemManageCard
            item={item}
            currencySymbol={currencySymbol}
            onToggleAvailability={handleToggle}
            onEdit={handleEdit}
            onDelete={(id) => setDeleteItemId(id)}
          />
        )}
        ListEmptyComponent={<EmptyState icon="food-off" title="No menu items" />}
        contentContainerStyle={styles.list}
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {
          setEditItem(null);
          setShowItemModal(true);
        }}
      />

      <MenuItemModal
        visible={showItemModal}
        onDismiss={() => {
          setShowItemModal(false);
          setEditItem(null);
        }}
        onSubmit={handleSubmit}
        loading={createItem.isPending || updateItem.isPending}
        initialData={editItem}
        categories={categories || []}
        currencySymbol={currencySymbol}
      />

      <ConfirmDialog
        visible={!!deleteItemId}
        title="Delete Item"
        message="Are you sure you want to delete this menu item?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteItemId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  search: { marginHorizontal: 16, marginTop: 8 },
  categoryScroll: { maxHeight: 48, marginVertical: 8 },
  categoryContent: { paddingHorizontal: 16, gap: 6 },
  categoryChip: {},
  list: { paddingTop: 4, paddingBottom: 80 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
