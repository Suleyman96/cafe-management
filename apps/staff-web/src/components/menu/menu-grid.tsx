'use client';

import type { Database } from '@gustri/database';
import type { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui-web';
import { Pencil, Search, Trash2, UtensilsCrossed } from 'lucide-react';
import { MenuItemCard, MenuItemSkeletonCard } from '@/components/menu/menu-item-card';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

type TFunc = ReturnType<typeof useTranslation>['t'];

interface MenuGridProps {
  isLoading: boolean;
  menuItems: MenuItem[];
  filteredItems: MenuItem[];
  uncategorizedItems: MenuItem[];
  groupedItems: Record<string, MenuItem[]>;
  categories: Category[];
  selectedCategory: string | null;
  searchQuery: string;
  categoryMap: Map<string, string>;
  onEditItem: (item: MenuItem) => void;
  onDeleteItem: (id: string) => void;
  onEditCategory: (category: Category) => void;
  onDeleteCategory: (id: string) => void;
  onToggleAvailability: (id: string, currentAvailable: boolean) => void;
  onToggleTakeoutable: (id: string, currentTakeoutable: boolean) => void;
  onToggleDeliverable: (id: string, currentDeliverable: boolean) => void;
  onAddMenuItem: () => void;
  t: TFunc;
}

export function MenuGrid({
  isLoading,
  menuItems,
  filteredItems,
  uncategorizedItems,
  groupedItems,
  categories,
  selectedCategory,
  searchQuery,
  categoryMap,
  onEditItem,
  onDeleteItem,
  onEditCategory,
  onDeleteCategory,
  onToggleAvailability,
  onToggleTakeoutable,
  onToggleDeliverable,
  onAddMenuItem,
  t,
}: MenuGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'].map((id) => (
          <MenuItemSkeletonCard key={id} />
        ))}
      </div>
    );
  }

  if (searchQuery.trim()) {
    if (filteredItems.length === 0) {
      return (
        <div className="bg-white rounded-xl border p-8 sm:p-12 text-center">
          <Search className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('menu.noSearchResults')}</h3>
          <p className="text-sm text-gray-500">{t('menu.tryDifferentSearch')}</p>
        </div>
      );
    }
    return (
      <div>
        <p className="text-sm text-gray-500 mb-3">
          {t('menu.searchResultsForQuery', {
            count: filteredItems.length,
            query: searchQuery,
          })}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              categoryIcon={item.category_id ? categoryMap.get(item.category_id) : undefined}
              onEdit={onEditItem}
              onDelete={onDeleteItem}
              onToggleAvailability={onToggleAvailability}
              onToggleTakeoutable={onToggleTakeoutable}
              onToggleDeliverable={onToggleDeliverable}
              t={t}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {categories.map((category) => {
        const items = selectedCategory
          ? selectedCategory === category.id
            ? groupedItems[category.id] || []
            : []
          : groupedItems[category.id] || [];

        if (selectedCategory && selectedCategory !== category.id) return null;
        if (!selectedCategory && items.length === 0) return null;

        return (
          <div key={category.id}>
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
                  onClick={() => onEditCategory(category)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title={t('edit', { ns: 'common' })}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDeleteCategory(category.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title={t('delete', { ns: 'common' })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed p-6 text-center text-sm text-gray-400">
                {t('menu.noItemsInCategory')}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    categoryIcon={category.icon || undefined}
                    onEdit={() => onEditItem(item)}
                    onDelete={() => onDeleteItem(item.id)}
                    onToggleAvailability={() => onToggleAvailability(item.id, item.is_available)}
                    onToggleTakeoutable={() => onToggleTakeoutable(item.id, item.is_takeoutable)}
                    onToggleDeliverable={() => onToggleDeliverable(item.id, item.is_deliverable)}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {uncategorizedItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">📂</span>
            <h2 className="text-base font-semibold text-gray-900">{t('menu.uncategorized')}</h2>
            <span className="text-xs text-gray-400">
              · {t('menu.items', { count: uncategorizedItems.length })}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {uncategorizedItems.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                onEdit={() => onEditItem(item)}
                onDelete={() => onDeleteItem(item.id)}
                onToggleAvailability={() => onToggleAvailability(item.id, item.is_available)}
                onToggleTakeoutable={() => onToggleTakeoutable(item.id, item.is_takeoutable)}
                onToggleDeliverable={() => onToggleDeliverable(item.id, item.is_deliverable)}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {menuItems.length === 0 && (
        <div className="bg-white rounded-xl border p-8 sm:p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <UtensilsCrossed className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('menu.noMenuItems')}</h3>
          <p className="text-sm text-gray-500 mb-6">{t('menu.getStarted')}</p>
          <Button onClick={onAddMenuItem} size="sm">
            + {t('menu.addMenuItem')}
          </Button>
        </div>
      )}
    </div>
  );
}
