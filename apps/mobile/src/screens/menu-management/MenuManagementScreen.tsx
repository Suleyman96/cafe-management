import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, FAB, IconButton, Searchbar } from 'react-native-paper';
import { CategoryModal } from '@/components/menu-management/CategoryModal';
import { MenuItemManageCard } from '@/components/menu-management/MenuItemManageCard';
import { MenuItemModal } from '@/components/menu-management/MenuItemModal';
import { ConfirmDialog, EmptyState, ErrorScreen, LoadingScreen } from '@/components/ui';
import { useCategories, useMenuItems } from '@/hooks';
import { useCafeSettings } from '@/hooks/use-cafe-settings';
import {
  useCreateCategory,
  useCreateMenuItem,
  useDeleteCategory,
  useDeleteMenuItem,
  useToggleMenuItemAvailability,
  useUpdateCategory,
  useUpdateMenuItem,
} from '@/hooks/use-menu-management';
import { useSnackbar } from '@/hooks/use-snackbar';
import { Text } from '@/lib/paper-compat';

export default function MenuManagementScreen() {
  const { showSuccess, showError } = useSnackbar();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [showItemModal, setShowItemModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  // Category modal state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editCategory, setEditCategory] = useState<any>(null);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);

  const { data: items, isLoading, error, refetch } = useMenuItems({ categoryId: categoryFilter });
  const { data: categories } = useCategories();
  const { data: settings } = useCafeSettings();

  // Item mutations
  const createItem = useCreateMenuItem();
  const updateItem = useUpdateMenuItem();
  const deleteItem = useDeleteMenuItem();
  const toggleAvailability = useToggleMenuItemAvailability();

  // Category mutations
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const currencySymbol = settings?.currency_symbol || '$';

  // Search filter (name + description, like staff-web)
  const filtered = useMemo(() => {
    if (!items) return [];
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i: { name?: string; description?: string | null }) =>
        (i.name || '').toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q),
    );
  }, [items, search]);

  // Category item counts (from full list, not filtered)
  const getCategoryItemCount = (categoryId: string) =>
    (items || []).filter((i: { category_id: string | null }) => i.category_id === categoryId)
      .length;

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

  // Category handlers
  const handleCategorySubmit = async (data: any) => {
    try {
      if (editCategory) {
        await updateCategory.mutateAsync({ id: editCategory.id, data });
        showSuccess('Category updated');
      } else {
        await createCategory.mutateAsync(data);
        showSuccess('Category created');
      }
      setShowCategoryModal(false);
      setEditCategory(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to save category');
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategoryId) return;
    try {
      await deleteCategory.mutateAsync(deleteCategoryId);
      showSuccess('Category deleted');
      setDeleteCategoryId(null);
      if (categoryFilter === deleteCategoryId) setCategoryFilter(undefined);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to delete category');
    }
  };

  if (isLoading) return <LoadingScreen message="Loading menu..." />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      {/* Counts */}
      <View style={styles.countsRow}>
        <Text variant="bodySmall" style={styles.countText}>
          {(items || []).length} items · {(categories || []).length} categories
        </Text>
        <Button
          compact
          mode="outlined"
          icon="shape-plus"
          onPress={() => {
            setEditCategory(null);
            setShowCategoryModal(true);
          }}
          style={styles.addCategoryBtn}
          labelStyle={styles.addCategoryLabel}
        >
          + Category
        </Button>
      </View>

      <Searchbar
        placeholder="Search menu items..."
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />

      {/* Search results count */}
      {search.trim() && (
        <Text variant="bodySmall" style={styles.searchCount}>
          {filtered.length} results for "{search}"
        </Text>
      )}

      {/* Category Filter with icons + counts */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContent}
      >
        <Chip compact selected={!categoryFilter} onPress={() => setCategoryFilter(undefined)}>
          All ({(items || []).length})
        </Chip>
        {(categories || []).map((c: any) => (
          <Chip
            key={c.id}
            compact
            selected={categoryFilter === c.id}
            onPress={() => setCategoryFilter(categoryFilter === c.id ? undefined : c.id)}
          >
            {c.icon || '📁'} {c.name || '--'} ({getCategoryItemCount(c.id)})
          </Chip>
        ))}
      </ScrollView>

      {/* Category header with edit/delete when filtered */}
      {categoryFilter && (
        <View style={styles.categoryHeader}>
          {(() => {
            const cat = (categories || []).find((c: any) => c.id === categoryFilter);
            if (!cat) return null;
            return (
              <>
                <View style={styles.categoryHeaderLeft}>
                  <Text style={styles.categoryIcon}>{cat.icon || '📁'}</Text>
                  <Text variant="titleSmall" style={styles.categoryName}>
                    {cat.name}
                  </Text>
                  <Text variant="bodySmall" style={styles.categoryItemCount}>
                    · {getCategoryItemCount(cat.id)} items
                  </Text>
                </View>
                <View style={styles.categoryActions}>
                  <IconButton
                    icon="pencil"
                    size={16}
                    onPress={() => {
                      setEditCategory(cat);
                      setShowCategoryModal(true);
                    }}
                  />
                  <IconButton
                    icon="delete"
                    size={16}
                    iconColor="#ef4444"
                    onPress={() => setDeleteCategoryId(cat.id)}
                  />
                </View>
              </>
            );
          })()}
        </View>
      )}

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
        ListEmptyComponent={
          <EmptyState
            icon="food-off"
            title="No menu items"
            description={search ? 'Try a different search' : 'Create your first menu item'}
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

      <CategoryModal
        visible={showCategoryModal}
        onDismiss={() => {
          setShowCategoryModal(false);
          setEditCategory(null);
        }}
        onSubmit={handleCategorySubmit}
        loading={createCategory.isPending || updateCategory.isPending}
        initialData={editCategory}
      />

      <ConfirmDialog
        visible={!!deleteItemId}
        title="Delete Item"
        message="Are you sure you want to delete this menu item?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteItemId(null)}
        destructive
      />

      <ConfirmDialog
        visible={!!deleteCategoryId}
        title="Delete Category"
        message="Are you sure you want to delete this category? Items in this category will become uncategorized."
        onConfirm={handleDeleteCategory}
        onCancel={() => setDeleteCategoryId(null)}
        destructive
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  countsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  countText: { color: '#9ca3af' },
  addCategoryBtn: { borderColor: '#d1d5db' },
  addCategoryLabel: { fontSize: 12 },
  search: { marginHorizontal: 16, marginTop: 8 },
  searchCount: { color: '#6b7280', paddingHorizontal: 16, paddingTop: 4 },
  categoryScroll: { maxHeight: 48, marginVertical: 8 },
  categoryContent: { paddingHorizontal: 16, gap: 6 },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  categoryHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryIcon: { fontSize: 20 },
  categoryName: { fontWeight: '600', color: '#1e293b' },
  categoryItemCount: { color: '#9ca3af' },
  categoryActions: { flexDirection: 'row' },
  list: { paddingTop: 4, paddingBottom: 80 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
