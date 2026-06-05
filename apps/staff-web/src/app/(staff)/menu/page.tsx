'use client';

import type { Database } from '@gustri/database/types';
import { useTranslation } from '@gustri/i18n';
import * as Sentry from '@sentry/nextjs';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CategoryModal } from '@/components/menu/category-modal';
import { MenuGrid } from '@/components/menu/menu-grid';
import { MenuItemModal } from '@/components/menu/menu-item-modal';
import { MenuPageHeader } from '@/components/menu/menu-page-header';
import { ConfirmDialog } from '@/components/modals/confirm-dialog';
import {
  useCategories,
  useDeleteCategory,
  useDeleteMenuItem,
  useMenuItems,
  useToggleMenuItemAvailability,
  useToggleMenuItemDeliverable,
  useToggleMenuItemTakeoutable,
} from '@/hooks';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

export default function MenuPage() {
  const { t } = useTranslation('staff');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const { data: menuItems = [], isLoading: itemsLoading } = useMenuItems(
    selectedCategory ? { categoryId: selectedCategory } : undefined,
  );
  const deleteMenuItem = useDeleteMenuItem();
  const deleteCategory = useDeleteCategory();
  const toggleAvailability = useToggleMenuItemAvailability();
  const toggleTakeoutable = useToggleMenuItemTakeoutable();
  const toggleDeliverable = useToggleMenuItemDeliverable();

  const isLoading = itemsLoading || categoriesLoading;

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return menuItems;
    const q = searchQuery.toLowerCase();
    return menuItems.filter(
      (item: MenuItem) =>
        item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q),
    );
  }, [menuItems, searchQuery]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of categories) {
      map.set(cat.id, cat.icon || '📁');
    }
    return map;
  }, [categories]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, MenuItem[]> = {};
    for (const category of categories) {
      const items = filteredItems.filter((item: MenuItem) => item.category_id === category.id);
      if (items.length > 0 || selectedCategory === category.id) {
        groups[category.id] = items;
      }
    }
    return groups;
  }, [categories, filteredItems, selectedCategory]);

  const uncategorizedItems = useMemo(
    () => filteredItems.filter((item: MenuItem) => !item.category_id),
    [filteredItems],
  );

  const handleConfirmDeleteItem = async () => {
    if (!deletingItemId) return;
    try {
      await deleteMenuItem.mutateAsync(deletingItemId);
      toast.success(t('menu.itemDeleted'));
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t('menu.failedDeleteItem'));
    } finally {
      setDeletingItemId(null);
    }
  };

  const handleConfirmDeleteCategory = async () => {
    if (!deletingCategoryId) return;
    try {
      await deleteCategory.mutateAsync(deletingCategoryId);
      toast.success(t('menu.categoryDeleted'));
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t('menu.failedDeleteCategory'));
    } finally {
      setDeletingCategoryId(null);
    }
  };

  const { mutateAsync: toggleAvailabilityAsync } = toggleAvailability;
  const handleToggleAvailability = useCallback(
    async (id: string, currentAvailable: boolean) => {
      try {
        await toggleAvailabilityAsync({ id, currentAvailable });
      } catch (error) {
        Sentry.captureException(error);
        toast.error(t('menu.failedToggleAvailability'));
      }
    },
    [toggleAvailabilityAsync, t],
  );

  const { mutateAsync: toggleTakeoutableAsync } = toggleTakeoutable;
  const handleToggleTakeoutable = useCallback(
    async (id: string, currentTakeoutable: boolean) => {
      try {
        await toggleTakeoutableAsync({ id, currentTakeoutable });
      } catch (error) {
        Sentry.captureException(error);
        toast.error(t('menu.failedToggleTakeoutable'));
      }
    },
    [toggleTakeoutableAsync, t],
  );

  const { mutateAsync: toggleDeliverableAsync } = toggleDeliverable;
  const handleToggleDeliverable = useCallback(
    async (id: string, currentDeliverable: boolean) => {
      try {
        await toggleDeliverableAsync({ id, currentDeliverable });
      } catch (error) {
        Sentry.captureException(error);
        toast.error(t('menu.failedToggleDeliverable'));
      }
    },
    [toggleDeliverableAsync, t],
  );

  const getCategoryItemCount = useCallback(
    (categoryId: string) =>
      menuItems.filter((item: MenuItem) => item.category_id === categoryId).length,
    [menuItems],
  );

  const openAddCategory = useCallback(() => {
    setEditingCategory(null);
    setShowCategoryModal(true);
  }, []);

  const openAddMenuItem = useCallback(() => {
    setEditingItem(null);
    setShowItemModal(true);
  }, []);

  const openEditItem = useCallback((item: MenuItem) => {
    setEditingItem(item);
    setShowItemModal(true);
  }, []);

  const openEditCategory = useCallback((category: Category) => {
    setEditingCategory(category);
    setShowCategoryModal(true);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <MenuPageHeader
        categories={categories}
        menuItemCount={menuItems.length}
        filteredItemCount={filteredItems.length}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddCategory={openAddCategory}
        onAddMenuItem={openAddMenuItem}
        getCategoryItemCount={getCategoryItemCount}
        t={t}
      />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <MenuGrid
          isLoading={isLoading}
          menuItems={menuItems}
          filteredItems={filteredItems}
          uncategorizedItems={uncategorizedItems}
          groupedItems={groupedItems}
          categories={categories}
          selectedCategory={selectedCategory}
          searchQuery={searchQuery}
          categoryMap={categoryMap}
          onEditItem={openEditItem}
          onDeleteItem={setDeletingItemId}
          onEditCategory={openEditCategory}
          onDeleteCategory={setDeletingCategoryId}
          onToggleAvailability={handleToggleAvailability}
          onToggleTakeoutable={handleToggleTakeoutable}
          onToggleDeliverable={handleToggleDeliverable}
          onAddMenuItem={openAddMenuItem}
          t={t}
        />
      </main>

      {showItemModal && (
        <MenuItemModal
          item={editingItem || undefined}
          categories={categories}
          menuItems={menuItems}
          onClose={() => {
            setShowItemModal(false);
            setEditingItem(null);
          }}
        />
      )}

      {showCategoryModal && (
        <CategoryModal
          category={editingCategory || undefined}
          categories={categories}
          onClose={() => {
            setShowCategoryModal(false);
            setEditingCategory(null);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={!!deletingItemId}
        onClose={() => setDeletingItemId(null)}
        onConfirm={handleConfirmDeleteItem}
        title={t('delete', { ns: 'common' })}
        message={t('menu.confirmDeleteItem')}
      />
      <ConfirmDialog
        isOpen={!!deletingCategoryId}
        onClose={() => setDeletingCategoryId(null)}
        onConfirm={handleConfirmDeleteCategory}
        title={t('delete', { ns: 'common' })}
        message={t('menu.confirmDeleteCategory')}
      />
    </div>
  );
}
