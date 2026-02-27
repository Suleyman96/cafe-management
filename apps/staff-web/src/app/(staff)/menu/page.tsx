'use client';

import type { Database } from '@cafe-idare/database';
import { useTranslation } from '@cafe-idare/i18n';
import { Button } from '@cafe-idare/ui';
import { Clock, Pencil, Search, Trash2, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CategoryModal } from '@/components/menu/category-modal';
import { MenuItemModal } from '@/components/menu/menu-item-modal';
import {
  type CafeSettings,
  formatPriceWithSettings,
  useCafeSettings,
  useCategories,
  useDeleteCategory,
  useDeleteMenuItem,
  useMenuItems,
  useToggleMenuItemAvailability,
} from '@/hooks';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

/* ------------------------------------------------------------------ */
/*  Menu Item Card                                                     */
/* ------------------------------------------------------------------ */

function MenuItemCard({
  item,
  categoryIcon,
  settings,
  onEdit,
  onDelete,
  onToggleAvailability,
  t,
}: {
  item: MenuItem;
  categoryIcon?: string;
  settings: CafeSettings | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAvailability: () => void;
  t: (key: string, opts?: any) => string;
}) {
  const formatPrice = (price: number) => {
    if (settings) return formatPriceWithSettings(price, settings);
    return `$${price.toFixed(2)}`;
  };

  return (
    <div
      className={`group relative bg-white rounded-xl border overflow-hidden transition-all hover:shadow-lg ${
        !item.is_available ? 'ring-1 ring-red-200' : 'hover:border-gray-300'
      }`}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className={`w-full h-full object-cover transition-transform group-hover:scale-105 ${
              !item.is_available ? 'grayscale opacity-70' : ''
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <span className="text-4xl opacity-40">{categoryIcon || '🍽️'}</span>
          </div>
        )}

        {/* Unavailable overlay */}
        {!item.is_available && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <span className="bg-red-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
              {t('menu.unavailable')}
            </span>
          </div>
        )}

        {/* Daily special badge */}
        {item.is_daily_special && item.is_available && (
          <div className="absolute top-2 left-2">
            <span className="bg-amber-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
              ✨ {t('menu.dailySpecial')}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <h3 className="font-semibold text-gray-900 truncate">{item.name}</h3>
        {item.description && (
          <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">{item.description}</p>
        )}

        {/* Price + prep time */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-base font-bold text-blue-600">
            {formatPrice(parseFloat(item.price.toString()))}
          </span>
          {item.preparation_time && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              {item.preparation_time} {t('kitchen.min')}
            </span>
          )}
        </div>

        {/* Dietary badges */}
        {(item.is_popular || item.is_vegetarian || item.is_vegan || item.is_gluten_free || item.is_spicy) && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.is_popular && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-yellow-50 text-yellow-700 rounded-full">
                ⭐ {t('menu.popular')}
              </span>
            )}
            {item.is_vegetarian && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-50 text-green-700 rounded-full">
                🌱
              </span>
            )}
            {item.is_vegan && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-50 text-green-700 rounded-full">
                🌿
              </span>
            )}
            {item.is_gluten_free && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 rounded-full">
                🌾
              </span>
            )}
            {item.is_spicy && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-50 text-red-700 rounded-full">
                🌶️
              </span>
            )}
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          {/* Availability toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleAvailability();
            }}
            className="flex items-center gap-1.5 text-xs font-medium transition-colors"
            title={item.is_available ? t('menu.markUnavailable') : t('menu.markAvailable')}
          >
            <div
              className={`relative w-8 h-[18px] rounded-full transition-colors ${
                item.is_available ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform ${
                  item.is_available ? 'left-[16px]' : 'left-[2px]'
                }`}
              />
            </div>
            <span className={item.is_available ? 'text-green-600' : 'text-gray-400'}>
              {item.is_available ? t('menu.available') : t('menu.unavailableShort')}
            </span>
          </button>

          {/* Edit / Delete */}
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title={t('edit', { ns: 'common' })}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title={t('delete', { ns: 'common' })}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton Card                                                      */
/* ------------------------------------------------------------------ */

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="h-5 bg-gray-200 rounded w-1/3 mt-2" />
        <div className="h-px bg-gray-100 mt-3" />
        <div className="flex justify-between mt-2">
          <div className="h-4 bg-gray-100 rounded w-16" />
          <div className="flex gap-1">
            <div className="h-7 w-7 bg-gray-100 rounded-lg" />
            <div className="h-7 w-7 bg-gray-100 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function MenuPage() {
  const { t } = useTranslation('staff');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Use hooks - these require QueryClientProvider
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const { data: menuItems = [], isLoading: itemsLoading } = useMenuItems(
    selectedCategory ? { categoryId: selectedCategory } : undefined,
  );
  const { data: settings } = useCafeSettings();
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
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)),
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

  const handleDeleteItem = async (id: string) => {
    if (!confirm(t('menu.confirmDeleteItem'))) return;
    try {
      await deleteMenuItem.mutateAsync(id);
      toast.success(t('menu.itemDeleted'));
    } catch (error) {
      console.error('Failed to delete menu item:', error);
      toast.error(t('menu.failedDeleteItem'));
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm(t('menu.confirmDeleteCategory'))) return;
    try {
      await deleteCategory.mutateAsync(id);
      toast.success(t('menu.categoryDeleted'));
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast.error(t('menu.failedDeleteCategory'));
    }
  };

  const handleToggleAvailability = async (id: string) => {
    try {
      await toggleAvailability.mutateAsync(id);
    } catch (error) {
      console.error('Failed to toggle availability:', error);
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
                  {filteredItems.length} {t('menu.items')} · {categories.length}{' '}
                  {t('menu.categories')}
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
                <span className="hidden sm:inline">+ Add Category</span>
                <span className="sm:hidden">+ Category</span>
              </Button>
              <Button
                onClick={() => {
                  setEditingItem(null);
                  setShowItemModal(true);
                }}
                size="sm"
                className="text-xs sm:text-sm"
              >
                <span className="hidden sm:inline">+ Add Menu Item</span>
                <span className="sm:hidden">+ Item</span>
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
              All ({menuItems.length})
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
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
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
                        categoryIcon={item.category_id ? categoryMap.get(item.category_id) : undefined}
                        settings={settings}
                        onEdit={() => {
                          setEditingItem(item);
                          setShowItemModal(true);
                        }}
                        onDelete={() => handleDeleteItem(item.id)}
                        onToggleAvailability={() => handleToggleAvailability(item.id)}
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
                  <p className="text-sm text-gray-500">
                    {t('menu.tryDifferentSearch')}
                  </p>
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
                          <h2 className="text-base font-semibold text-gray-900">
                            {category.name}
                          </h2>
                          <span className="text-xs text-gray-400">
                            · {items.length} {t('menu.items')}
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
                            onClick={() => handleDeleteCategory(category.id)}
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
                              settings={settings}
                              onEdit={() => {
                                setEditingItem(item);
                                setShowItemModal(true);
                              }}
                              onDelete={() => handleDeleteItem(item.id)}
                              onToggleAvailability={() => handleToggleAvailability(item.id)}
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
                        · {uncategorizedItems.length} {t('menu.items')}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {uncategorizedItems.map((item: MenuItem) => (
                        <MenuItemCard
                          key={item.id}
                          item={item}
                          settings={settings}
                          onEdit={() => {
                            setEditingItem(item);
                            setShowItemModal(true);
                          }}
                          onDelete={() => handleDeleteItem(item.id)}
                          onToggleAvailability={() => handleToggleAvailability(item.id)}
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
    </div>
  );
}
