'use client';

import type { Database } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
import * as Sentry from '@sentry/nextjs';
import { Pencil, Search, Trash2, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CategoryModal } from '@/components/menu/category-modal';
import { MenuItemCard, MenuItemSkeletonCard } from '@/components/menu/menu-item-card';
import { MenuItemModal } from '@/components/menu/menu-item-modal';
import { ConfirmDialog } from '@/components/modals/confirm-dialog';
import {
  useCategories,
  useDeleteCategory,
  useDeleteMenuItem,
  useMenuItems,
  useToggleMenuItemAvailability,
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

  // Use hooks - these require QueryClientProvider
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const { data: menuItems = [], isLoading: itemsLoading } = useMenuItems(
    selectedCategory ? { categoryId: selectedCategory } : undefined,
  );
  const deleteMenuItem = useDeleteMenuItem();
  const deleteCategory = useDeleteCategory();
  const toggleAvailability = useToggleMenuItemAvailability();

  const isLoading = itemsLoading || categoriesLoading;

  // Search filter
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return menuItems;
    const q = searchQuery.toLowerCase();
    return menuItems.filter(
      (item: MenuItem) =>
        item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q),
    );
  }, [menuItems, searchQuery]);

  // Group items by category
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

  const handleToggleAvailability = async (id: string, currentAvailable: boolean) => {
    try {
      await toggleAvailability.mutateAsync({ id, currentAvailable });
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t('menu.failedToggleAvailability'));
    }
  };

  // Item count for a category in the full (unfiltered) menuItems list
  const getCategoryItemCount = (categoryId: string) =>
    menuItems.filter((item: MenuItem) => item.category_id === categoryId).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          {/* Top row: title + actions */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm shrink-0">
                ←
              </Link>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                  {t('menu.title')}
                </h1>
                <p className="text-xs text-gray-400 hidden sm:block">
                  {t('menu.items', { count: filteredItems.length })} ·{' '}
                  {t('menu.categories', { count: categories.length })}
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                onClick={() => {
                  setEditingCategory(null);
                  setShowCategoryModal(true);
                }}
                variant="outline"
                size="sm"
                className="text-xs sm:text-sm"
              >
                <span className="hidden sm:inline">+ {t('menu.addCategory')}</span>
                <span className="sm:hidden">+ {t('menu.categoryShort')}</span>
              </Button>
              <Button
                onClick={() => {
                  setEditingItem(null);
                  setShowItemModal(true);
                }}
                size="sm"
                className="text-xs sm:text-sm"
              >
                <span className="hidden sm:inline">+ {t('menu.addMenuItem')}</span>
                <span className="sm:hidden">+ {t('menu.itemShort')}</span>
              </Button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('menu.searchPlaceholder')}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                selectedCategory === null
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {t('menu.allItems')} ({menuItems.length})
            </button>
            {categories.map((category: Category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {category.icon || '📁'} {category.name} ({getCategoryItemCount(category.id)})
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {isLoading ? (
          /* Skeleton loading */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'].map((id) => (
              <MenuItemSkeletonCard key={id} />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Search results (no category grouping) */}
            {searchQuery.trim() ? (
              filteredItems.length > 0 ? (
                <div>
                  <p className="text-sm text-gray-500 mb-3">
                    {filteredItems.length} {t('menu.searchResults')} "{searchQuery}"
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredItems.map((item: MenuItem) => (
                      <MenuItemCard
                        key={item.id}
                        item={item}
                        categoryIcon={
                          item.category_id ? categoryMap.get(item.category_id) : undefined
                        }
                        onEdit={() => {
                          setEditingItem(item);
                          setShowItemModal(true);
                        }}
                        onDelete={() => setDeletingItemId(item.id)}
                        onToggleAvailability={() =>
                          handleToggleAvailability(item.id, item.is_available)
                        }
                        t={t}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border p-8 sm:p-12 text-center">
                  <Search className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {t('menu.noSearchResults')}
                  </h3>
                  <p className="text-sm text-gray-500">{t('menu.tryDifferentSearch')}</p>
                </div>
              )
            ) : (
              /* Category-grouped view */
              <>
                {categories.map((category: Category) => {
                  const items = selectedCategory
                    ? selectedCategory === category.id
                      ? groupedItems[category.id] || []
                      : []
                    : groupedItems[category.id] || [];

                  if (selectedCategory && selectedCategory !== category.id) return null;
                  if (!selectedCategory && items.length === 0) return null;

                  return (
                    <div key={category.id}>
                      {/* Category header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{category.icon || '📁'}</span>
                          <h2 className="text-base font-semibold text-gray-900">{category.name}</h2>
                          <span className="text-xs text-gray-400">
                            · {t('menu.items', { count: items.length })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingCategory(category);
                              setShowCategoryModal(true);
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title={t('edit', { ns: 'common' })}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeletingCategoryId(category.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title={t('delete', { ns: 'common' })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Items grid */}
                      {items.length === 0 ? (
                        <div className="bg-white rounded-xl border border-dashed p-6 text-center text-sm text-gray-400">
                          {t('menu.noItemsInCategory')}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {items.map((item: MenuItem) => (
                            <MenuItemCard
                              key={item.id}
                              item={item}
                              categoryIcon={category.icon || undefined}
                              onEdit={() => {
                                setEditingItem(item);
                                setShowItemModal(true);
                              }}
                              onDelete={() => setDeletingItemId(item.id)}
                              onToggleAvailability={() =>
                                handleToggleAvailability(item.id, item.is_available)
                              }
                              t={t}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Uncategorized */}
                {uncategorizedItems.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xl">📂</span>
                      <h2 className="text-base font-semibold text-gray-900">
                        {t('menu.uncategorized')}
                      </h2>
                      <span className="text-xs text-gray-400">
                        · {t('menu.items', { count: uncategorizedItems.length })}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {uncategorizedItems.map((item: MenuItem) => (
                        <MenuItemCard
                          key={item.id}
                          item={item}
                          onEdit={() => {
                            setEditingItem(item);
                            setShowItemModal(true);
                          }}
                          onDelete={() => setDeletingItemId(item.id)}
                          onToggleAvailability={() =>
                            handleToggleAvailability(item.id, item.is_available)
                          }
                          t={t}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {menuItems.length === 0 && (
                  <div className="bg-white rounded-xl border p-8 sm:p-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                      <UtensilsCrossed className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {t('menu.noMenuItems')}
                    </h3>
                    <p className="text-sm text-gray-500 mb-6">{t('menu.getStarted')}</p>
                    <Button
                      onClick={() => {
                        setEditingItem(null);
                        setShowItemModal(true);
                      }}
                      size="sm"
                    >
                      + {t('menu.addMenuItem')}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      {showItemModal && (
        <MenuItemModal
          item={editingItem || undefined}
          categories={categories}
          onClose={() => {
            setShowItemModal(false);
            setEditingItem(null);
          }}
        />
      )}

      {showCategoryModal && (
        <CategoryModal
          category={editingCategory || undefined}
          onClose={() => {
            setShowCategoryModal(false);
            setEditingCategory(null);
          }}
        />
      )}

      {/* Delete Confirmations */}
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
