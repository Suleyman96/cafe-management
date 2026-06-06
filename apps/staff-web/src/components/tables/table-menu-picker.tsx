'use client';

import { useTranslation } from '@gustri/i18n';
import { X } from 'lucide-react';
import { MenuItemThumb } from '@/components/menu/menu-item-thumb';
import type { Category, MenuItem } from '@/components/tables/use-table-detail';

interface TableMenuPickerProps {
  categories: Category[] | undefined;
  selectedCategory: string | null;
  setSelectedCategory: (categoryId: string) => void;
  filteredItems: MenuItem[] | undefined;
  getCartQuantity: (menuItemId: string) => number;
  addToCart: (menuItem: MenuItem) => void;
  taxMultiplier: number;
  formatPrice: (amount: number) => string;
  cartLength: number;
  onClose: () => void;
}

export function TableMenuPicker({
  categories,
  selectedCategory,
  setSelectedCategory,
  filteredItems,
  getCartQuantity,
  addToCart,
  taxMultiplier,
  formatPrice,
  cartLength,
  onClose,
}: TableMenuPickerProps) {
  const { t } = useTranslation('staff');

  return (
    <div
      className={`flex flex-col min-h-0 overflow-hidden ${cartLength > 0 ? 'h-[35%] flex-shrink-0' : 'flex-1'}`}
    >
      {/* Menu Header with Close Button */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-gray-200 flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-700">{t('menu', { ns: 'nav' })}</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex gap-3 px-3 sm:px-4 min-h-0 flex-1 overflow-hidden">
        {/* Category Sidebar */}
        <div className="w-24 sm:w-32 lg:w-44 flex-shrink-0 overflow-y-auto py-2">
          <div className="space-y-1">
            {categories?.map((category: Category) => (
              <button
                type="button"
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`w-full flex items-center gap-2 px-2 py-2.5 rounded-lg text-sm transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <span className="text-lg flex-shrink-0">{category.icon || '📋'}</span>
                <span className="truncate text-xs sm:text-sm">{category.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Menu Items Grid */}
        <div className="flex-1 min-w-0 overflow-y-auto py-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {filteredItems?.map((item: MenuItem) => {
              const quantity = getCartQuantity(item.id);
              return (
                <div
                  key={item.id}
                  className={`border rounded-lg overflow-hidden cursor-pointer transition-all ${
                    quantity > 0 ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-400'
                  }`}
                  onClick={() => addToCart(item)}
                >
                  <div className="relative">
                    <MenuItemThumb
                      imageUrl={item.image_url}
                      // 4:3 matches the menu admin cards (menu-item-card.tsx)
                      // — keeps the two surfaces visually consistent and
                      // avoids the "much taller cards" regression that
                      // aspect-square caused for waiters used to dense
                      // grids on table-detail.
                      className="aspect-[4/3] bg-gray-100 flex items-center justify-center overflow-hidden"
                      imageClassName="w-full h-full object-cover"
                      fallbackClassName="text-3xl opacity-40"
                    />
                    {quantity > 0 && (
                      <span className="absolute top-1.5 right-1.5 bg-blue-500 text-white text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full shadow">
                        {quantity}
                      </span>
                    )}
                  </div>
                  <div className="p-3 sm:p-4">
                    <h3 className="font-medium text-xs sm:text-sm line-clamp-2 mb-1 sm:mb-2">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="text-xs text-gray-500 mb-1 sm:mb-2 line-clamp-2 hidden sm:block">
                        {item.description}
                      </p>
                    )}
                    <p className="font-semibold text-blue-600 text-sm sm:text-base">
                      {formatPrice(item.price * taxMultiplier)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
