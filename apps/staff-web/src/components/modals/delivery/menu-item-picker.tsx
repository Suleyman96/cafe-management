'use client';

import type { MenuItem } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { useState } from 'react';
import { useFormatPrice } from '@/hooks/use-format-price';

interface MenuItemPickerProps {
  menuItems: MenuItem[];
  taxMultiplier: number;
  onAddItem: (item: MenuItem) => void;
}

export function MenuItemPicker({ menuItems, taxMultiplier, onAddItem }: MenuItemPickerProps) {
  const { t } = useTranslation('staff');
  const formatPrice = useFormatPrice();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = menuItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div>
      <h3 className="font-semibold text-lg mb-4">{t('orders.addItems')}</h3>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t('orders.searchMenuItems')}
        className="w-full px-4 py-2 mb-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      />
      <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-3">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onAddItem(item)}
            disabled={!item.is_available}
            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
              item.is_available
                ? 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
            }`}
          >
            <div className="flex-1">
              <div className="font-medium">{item.name}</div>
              {!item.is_available && (
                <div className="text-xs text-red-600">{t('orders.unavailable')}</div>
              )}
            </div>
            <div className="font-semibold">{formatPrice(item.price * taxMultiplier)}</div>
          </button>
        ))}
        {filteredItems.length === 0 && (
          <div className="text-center py-8 text-gray-500">{t('orders.noItemsFound')}</div>
        )}
      </div>
    </div>
  );
}
