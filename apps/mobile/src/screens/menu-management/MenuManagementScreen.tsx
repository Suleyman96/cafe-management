import type { Category, MenuItem, MenuItemsInsert, MenuItemsUpdate } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { ConfirmDialog, EmptyState, ErrorScreen, LoadingScreen } from '@gustri/ui-mobile';
import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, FAB, IconButton, Searchbar } from 'react-native-paper';
import { CategoryModal } from '@/components/menu-management/CategoryModal';
import { MenuItemManageCard } from '@/components/menu-management/MenuItemManageCard';
import { MenuItemModal } from '@/components/menu-management/MenuItemModal';
import { useCategories, useCurrencySymbol } from '@/hooks/local';
import { useMenuItems } from '@/hooks/shared';
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
import { buildCategoryItemCounts } from '@/lib/build-category-item-counts';
import { Text } from '@/lib/paper-compat';
import { COLORS } from '@/theme';

export default function MenuManagementScreen() {
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const { showSuccess, showError } = useSnackbar();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [showItemModal, setShowItemModal] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  // Category modal state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);

  const {
    data: items,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useMenuItems({ categoryId: categoryFilter });
  const { data: categories } = useCategories();

  // Item mutations
  const createItem = useCreateMenuItem();
  const updateItem = useUpdateMenuItem();
  const deleteItem = useDeleteMenuItem();
  const toggleAvailability = useToggleMenuItemAvailability();

  // Category mutations
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const currencySymbol = useCurrencySymbol();

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

  // Category item counts (from full list, not filtered). Build the map once
  // per items change — the chip loop below reads it O(1) per category.
  // Pre-M11: nested filter rebuilt the count for every chip render.
  const categoryItemCounts = useMemo(
    () => buildCategoryItemCounts((items || []) as { category_id: string | null }[]),
    [items],
  );

  const getCategoryItemCount = (categoryId: string) => categoryItemCounts.get(categoryId) ?? 0;

  const handleToggle = async (id: string, currentAvailable: boolean) => {
    try {
      await toggleAvailability.mutateAsync({ id, currentAvailable });
    } catch (err: unknown) {
      showError(err instanceof Error ? err : t('menu.failedToggle'));
    }
  };

  const handleEdit = (id: string) => {
    const item = items?.find((i: { id: string }) => i.id === id);
    if (item) {
      setEditItem(item);
      setShowItemModal(true);
    }
  };

  const handleSubmit = async (
    data: Record<string, string | number | boolean | string[] | null>,
  ) => {
    try {
      if (editItem) {
        await updateItem.mutateAsync({ id: editItem.id, data: data as MenuItemsUpdate });
        showSuccess(t('menu.itemUpdated'));
      } else {
        await createItem.mutateAsync(data as MenuItemsInsert);
        showSuccess(t('menu.itemCreated'));
      }
      setShowItemModal(false);
      setEditItem(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err : t('menu.failedSaveItem'));
    }
  };

  const handleDelete = async () => {
    if (!deleteItemId) return;
    try {
      await deleteItem.mutateAsync(deleteItemId);
      showSuccess(t('menu.itemDeleted'));
      setDeleteItemId(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err : t('menu.failedDelete'));
    }
  };

  // Category handlers
  const handleCategorySubmit = async (data: {
    name: string;
    description: string;
    icon: string;
    display_order: number;
    is_active: boolean;
  }) => {
    try {
      if (editCategory) {
        await updateCategory.mutateAsync({ id: editCategory.id, data });
        showSuccess(t('menu.categoryUpdated'));
      } else {
        await createCategory.mutateAsync(data);
        showSuccess(t('menu.categoryCreated'));
      }
      setShowCategoryModal(false);
      setEditCategory(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err : t('menu.failedSaveCategory'));
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategoryId) return;
    try {
      await deleteCategory.mutateAsync(deleteCategoryId);
      showSuccess(t('menu.categoryDeleted'));
      setDeleteCategoryId(null);
      if (categoryFilter === deleteCategoryId) setCategoryFilter(undefined);
    } catch (err: unknown) {
      showError(err instanceof Error ? err : t('menu.failedDeleteCategory'));
    }
  };

  if (isLoading) return <LoadingScreen message={t('menu.loadingMenu')} />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      {/* Counts */}
      <View style={styles.countsRow}>
        <Text variant="bodySmall" style={styles.countText}>
          {(items || []).length} {tCommon('items')} · {(categories || []).length}{' '}
          {t('menu.categories')}
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
          {t('menu.addCategory')}
        </Button>
      </View>

      <Searchbar
        placeholder={t('menu.searchItems')}
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />

      {/* Search results count */}
      {search.trim() && (
        <Text variant="bodySmall" style={styles.searchCount}>
          {t('menu.searchResultsCount', { count: filtered.length, query: search })}
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
          {tCommon('all')} ({(items || []).length})
        </Chip>
        {(categories || []).map((c) => (
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
            const cat = (categories || []).find((c) => c.id === categoryFilter);
            if (!cat) return null;
            return (
              <>
                <View style={styles.categoryHeaderLeft}>
                  <Text style={styles.categoryIcon}>{cat.icon || '📁'}</Text>
                  <Text variant="titleSmall" style={styles.categoryName}>
                    {cat.name}
                  </Text>
                  <Text variant="bodySmall" style={styles.categoryItemCount}>
                    · {getCategoryItemCount(cat.id)} {tCommon('items')}
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
                    iconColor={COLORS.danger}
                    onPress={() => setDeleteCategoryId(cat.id)}
                  />
                </View>
              </>
            );
          })()}
        </View>
      )}

      <FlashList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
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
            title={t('menu.noMenuItems')}
            description={search ? t('menu.tryDifferentSearch') : t('menu.noMenuItemsDescription')}
          />
        }
        contentContainerStyle={styles.list}
      />

      <FAB
        icon="plus"
        label={t('menu.addItem')}
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
        title={t('menu.deleteItem')}
        message={t('menu.deleteItemConfirm')}
        onConfirm={handleDelete}
        onCancel={() => setDeleteItemId(null)}
        destructive
      />

      <ConfirmDialog
        visible={!!deleteCategoryId}
        title={t('menu.deleteCategory')}
        message={t('menu.deleteCategoryConfirm')}
        onConfirm={handleDeleteCategory}
        onCancel={() => setDeleteCategoryId(null)}
        destructive
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  countsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  countText: { color: COLORS.textLight },
  addCategoryBtn: { borderColor: COLORS.border },
  addCategoryLabel: { fontSize: 12 },
  search: { marginHorizontal: 16, marginTop: 8 },
  searchCount: { color: COLORS.textMuted, paddingHorizontal: 16, paddingTop: 4 },
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
  categoryName: { fontWeight: '600', color: COLORS.textPrimary },
  categoryItemCount: { color: COLORS.textLight },
  categoryActions: { flexDirection: 'row' },
  list: { paddingTop: 4, paddingBottom: 80 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
