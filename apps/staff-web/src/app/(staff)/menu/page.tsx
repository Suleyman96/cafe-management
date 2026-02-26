'use client';

import type { Database } from '@cafe-idare/database';
import { useTranslation } from '@cafe-idare/i18n';
import { Button } from '@cafe-idare/ui';
import Link from 'next/link';
import { useState } from 'react';
import { CategoryModal } from '@/components/menu/category-modal';
import { MenuItemModal } from '@/components/menu/menu-item-modal';
import { useCategories, useDeleteCategory, useDeleteMenuItem, useMenuItems } from '@/hooks';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

export default function MenuPage() {
  const { t } = useTranslation('staff');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const { data: menuItems = [], isLoading: itemsLoading } = useMenuItems(
    selectedCategory ? { categoryId: selectedCategory } : undefined,
  );
  const deleteMenuItem = useDeleteMenuItem();
  const deleteCategory = useDeleteCategory();

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;
    try {
      await deleteMenuItem.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete menu item:', error);
      alert(t('menu.failedDeleteItem'));
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this category? All items in this category will be unassigned.',
      )
    )
      return;
    try {
      await deleteCategory.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete category:', error);
      alert(t('menu.failedDeleteCategory'));
    }
  };

  const groupedItems = categories.reduce(
    (acc: any, category: any) => {
      const items = menuItems.filter((item: any) => item.category_id === category.id);
      if (items.length > 0 || selectedCategory === category.id) {
        acc[category.id] = items;
      }
      return acc;
    },
    {} as Record<string, typeof menuItems>,
  );

  const uncategorizedItems = menuItems.filter((item: any) => !item.category_id);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-4">
              <Link href="/" className="text-gray-600 hover:text-gray-900 text-sm sm:text-base">
                ← {t('back', { ns: 'common' })}
              </Link>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900">{t('menu.title')}</h1>
                <p className="text-xs sm:text-sm text-gray-600">{t('menu.subtitle')}</p>
              </div>
            </div>
            <div className="flex gap-2">
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
                <span className="sm:hidden">+ {t('category', { ns: 'common' })}</span>
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
                <span className="sm:hidden">+ Item</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 ${
                selectedCategory === null
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {t('menu.allItems')} ({menuItems.length})
            </button>
            {categories.map((category: any) => {
              const count = menuItems.filter(
                (item: any) => item.category_id === category.id,
              ).length;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 ${
                    selectedCategory === category.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {category.name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {itemsLoading || categoriesLoading ? (
          <div className="text-center py-8 sm:py-12">
            <div className="inline-block animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600"></div>
            <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-600">
              {t('loading', { ns: 'common' })}...
            </p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-8">
            {categories.map((category) => {
              const items = selectedCategory
                ? selectedCategory === category.id
                  ? groupedItems[category.id] || []
                  : []
                : groupedItems[category.id] || [];

              if (selectedCategory && selectedCategory !== category.id) return null;
              if (!selectedCategory && items.length === 0) return null;

              return (
                <div key={category.id} className="bg-white rounded-lg shadow-sm border">
                  <div className="p-3 sm:p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="text-xl sm:text-2xl">{category.icon || '📁'}</span>
                      <div>
                        <h2 className="text-base sm:text-xl font-semibold text-gray-900">
                          {category.name}
                        </h2>
                        <p className="text-xs sm:text-sm text-gray-600 line-clamp-1">
                          {category.description || t('menu.noDescription')}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 self-end sm:self-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingCategory(category);
                          setShowCategoryModal(true);
                        }}
                        className="text-xs sm:text-sm"
                      >
                        {t('edit', { ns: 'common' })}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:bg-red-50 text-xs sm:text-sm"
                        onClick={() => handleDeleteCategory(category.id)}
                      >
                        {t('delete', { ns: 'common' })}
                      </Button>
                    </div>
                  </div>

                  {items.length === 0 ? (
                    <div className="p-6 sm:p-8 text-center text-sm sm:text-base text-gray-500">
                      {t('menu.noItemsInCategory')}
                    </div>
                  ) : (
                    <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      {items.map((item: any) => (
                        <div
                          key={item.id}
                          className={`border rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow ${
                            !item.is_available ? 'opacity-60 bg-gray-50' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate">
                                {item.name}
                              </h3>
                              <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">
                                {item.description || t('menu.noDescription')}
                              </p>
                            </div>
                            {item.image_url && (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded ml-2 flex-shrink-0"
                              />
                            )}
                          </div>

                          <div className="flex items-center gap-2 mb-2 sm:mb-3">
                            <span className="text-base sm:text-lg font-bold text-blue-600">
                              ${parseFloat(item.price.toString()).toFixed(2)}
                            </span>
                            {item.preparation_time && (
                              <span className="text-xs text-gray-500">
                                ⏱ {item.preparation_time} {t('kitchen.min')}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-1 mb-2 sm:mb-3">
                            {item.is_popular && (
                              <span className="px-1.5 sm:px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
                                ⭐ <span className="hidden sm:inline">{t('menu.popular')}</span>
                              </span>
                            )}
                            {item.is_vegetarian && (
                              <span className="px-1.5 sm:px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                                🌱 <span className="hidden sm:inline">{t('menu.vegetarian')}</span>
                              </span>
                            )}
                            {item.is_vegan && (
                              <span className="px-1.5 sm:px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                                🌿 <span className="hidden sm:inline">{t('menu.vegan')}</span>
                              </span>
                            )}
                            {item.is_gluten_free && (
                              <span className="px-1.5 sm:px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                                🌾 <span className="hidden sm:inline">{t('menu.glutenFree')}</span>
                              </span>
                            )}
                            {item.is_spicy && (
                              <span className="px-1.5 sm:px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded">
                                🌶️ <span className="hidden sm:inline">{t('menu.spicy')}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingItem(item);
                                setShowItemModal(true);
                              }}
                              className="flex-1 text-xs sm:text-sm"
                            >
                              {t('edit', { ns: 'common' })}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50 text-xs sm:text-sm"
                              onClick={() => handleDeleteItem(item.id)}
                            >
                              {t('delete', { ns: 'common' })}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {uncategorizedItems.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-3 sm:p-4 border-b">
                  <h2 className="text-base sm:text-xl font-semibold text-gray-900">
                    {t('menu.uncategorized')}
                  </h2>
                </div>
                <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {uncategorizedItems.map((item: MenuItem) => (
                    <div
                      key={item.id}
                      className={`border rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow ${
                        !item.is_available ? 'opacity-60 bg-gray-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate">
                            {item.name}
                          </h3>
                          <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">
                            {item.description || t('menu.noDescription')}
                          </p>
                        </div>
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded ml-2 flex-shrink-0"
                          />
                        )}
                      </div>

                      <div className="flex items-center gap-2 mb-2 sm:mb-3">
                        <span className="text-base sm:text-lg font-bold text-blue-600">
                          ${parseFloat(item.price.toString()).toFixed(2)}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingItem(item);
                            setShowItemModal(true);
                          }}
                          className="flex-1 text-xs sm:text-sm"
                        >
                          {t('edit', { ns: 'common' })}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 text-xs sm:text-sm"
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          {t('delete', { ns: 'common' })}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {menuItems.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-8 sm:p-12 text-center">
                <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">🍽️</div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                  {t('menu.noMenuItems')}
                </h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
                  {t('menu.getStarted')}
                </p>
                <Button onClick={() => setShowItemModal(true)} size="sm" className="text-sm">
                  + {t('menu.addMenuItem')}
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

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
