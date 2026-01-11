'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useMenuItems,
  useCategories,
  useUpdateMenuItem,
  useToggleMenuItemAvailability,
} from '@/hooks';
import { Button } from '@cafe-idare/ui';
import { MenuItemModal } from '@/components/menu/menu-item-modal';
import { CategoryModal } from '@/components/menu/category-modal';
import type { Database } from '@cafe-idare/database';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

export default function MenuPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Use hooks - these require QueryClientProvider
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const { data: menuItems = [], isLoading: itemsLoading } = useMenuItems(selectedCategory ? { categoryId: selectedCategory } : undefined);
  // const deleteMenuItem = useDeleteMenuItem();
  // const deleteCategory = useDeleteCategory();

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;
    // await deleteMenuItem.mutateAsync(id);
    console.log('Delete not implemented yet');
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? All items in this category will be unassigned.')) return;
    // await deleteCategory.mutateAsync(id);
    console.log('Delete not implemented yet');
  };

  const groupedItems = categories.reduce((acc: any, category: any) => {
    const items = menuItems.filter((item: any) => item.category_id === category.id);
    if (items.length > 0 || selectedCategory === category.id) {
      acc[category.id] = items;
    }
    return acc;
  }, {} as Record<string, typeof menuItems>);

  const uncategorizedItems = menuItems.filter((item: any) => !item.category_id);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-gray-600 hover:text-gray-900">
                ← Back
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Menu Management</h1>
                <p className="text-sm text-gray-600">Manage menu items and categories</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setEditingCategory(null);
                  setShowCategoryModal(true);
                }}
                variant="outline"
              >
                + Add Category
              </Button>
              <Button
                onClick={() => {
                  setEditingItem(null);
                  setShowItemModal(true);
                }}
              >
                + Add Menu Item
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category Filter */}
        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${
                selectedCategory === null
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              All Items ({menuItems.length})
            </button>
            {categories.map((category: any) => {
              const count = menuItems.filter((item: any) => item.category_id === category.id).length;
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${
                    selectedCategory === category.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {category.name_en} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {itemsLoading || categoriesLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading menu...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Categories with Items */}
            {categories.map((category) => {
              const items = selectedCategory
                ? (selectedCategory === category.id ? groupedItems[category.id] || [] : [])
                : (groupedItems[category.id] || []);

              if (selectedCategory && selectedCategory !== category.id) return null;
              if (!selectedCategory && items.length === 0) return null;

              return (
                <div key={category.id} className="bg-white rounded-lg shadow-sm border">
                  <div className="p-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{category.icon || '📁'}</span>
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">{category.name_en}</h2>
                        <p className="text-sm text-gray-600">{category.description_en || 'No description'}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingCategory(category);
                          setShowCategoryModal(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => handleDeleteCategory(category.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  {items.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No items in this category
                    </div>
                  ) : (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {items.map((item: any) => (
                        <div
                          key={item.id}
                          className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                            !item.is_available ? 'opacity-60 bg-gray-50' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900">{item.name_en}</h3>
                              <p className="text-sm text-gray-600 line-clamp-2">{item.description_en || 'No description'}</p>
                            </div>
                            {item.image_url && (
                              <img
                                src={item.image_url}
                                alt={item.name_en}
                                className="w-16 h-16 object-cover rounded ml-2"
                              />
                            )}
                          </div>

                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-lg font-bold text-blue-600">
                              ${parseFloat(item.price.toString()).toFixed(2)}
                            </span>
                            {item.preparation_time && (
                              <span className="text-xs text-gray-500">
                                ⏱ {item.preparation_time} min
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-1 mb-3">
                            {item.is_popular && (
                              <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
                                ⭐ Popular
                              </span>
                            )}
                            {item.is_vegetarian && (
                              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                                🌱 Vegetarian
                              </span>
                            )}
                            {item.is_vegan && (
                              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                                🌿 Vegan
                              </span>
                            )}
                            {item.is_gluten_free && (
                              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                                🌾 Gluten Free
                              </span>
                            )}
                            {item.is_spicy && (
                              <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded">
                                🌶️ Spicy
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
                              className="flex-1"
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => handleDeleteItem(item.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Uncategorized Items */}
            {uncategorizedItems.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-4 border-b">
                  <h2 className="text-xl font-semibold text-gray-900">Uncategorized Items</h2>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {uncategorizedItems.map((item: MenuItem) => (
                    <div
                      key={item.id}
                      className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                        !item.is_available ? 'opacity-60 bg-gray-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{item.name_en}</h3>
                          <p className="text-sm text-gray-600 line-clamp-2">{item.description_en || 'No description'}</p>
                        </div>
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.name_en}
                            className="w-16 h-16 object-cover rounded ml-2"
                          />
                        )}
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg font-bold text-blue-600">
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
                          className="flex-1"
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {menuItems.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
                <div className="text-6xl mb-4">🍽️</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No menu items yet</h3>
                <p className="text-gray-600 mb-6">Get started by adding your first menu item</p>
                <Button onClick={() => setShowItemModal(true)}>
                  + Add Menu Item
                </Button>
              </div>
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
