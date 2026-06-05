'use client';

import type { MenuItem } from '@gustri/database/types';
import { useTranslation } from '@gustri/i18n';
import { useFormatPrice } from '@/hooks/use-format-price';

export interface SelectedItem {
  menuItem: MenuItem;
  quantity: number;
  notes: string;
}

interface SelectedItemsListProps {
  items: SelectedItem[];
  taxMultiplier: number;
  onUpdateQuantity: (menuItemId: string, quantity: number) => void;
  onUpdateNotes: (menuItemId: string, notes: string) => void;
}

export function SelectedItemsList({
  items,
  taxMultiplier,
  onUpdateQuantity,
  onUpdateNotes,
}: SelectedItemsListProps) {
  const { t } = useTranslation('staff');
  const formatPrice = useFormatPrice();

  return (
    <div>
      <h3 className="font-semibold text-lg mb-4">
        {t('orders.selectedItems')} ({items.length})
      </h3>

      {items.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">{t('orders.noItemsAddedYet')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('orders.selectFromMenu')}</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {items.map((item) => (
            <div key={item.menuItem.id} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="font-medium">{item.menuItem.name}</div>
                  <div className="text-sm text-gray-600">
                    {formatPrice(item.menuItem.price * taxMultiplier)} {t('each', { ns: 'common' })}
                  </div>
                </div>
                <button
                  onClick={() => onUpdateQuantity(item.menuItem.id, 0)}
                  className="text-red-500 hover:text-red-700"
                >
                  &#10005;
                </button>
              </div>

              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => onUpdateQuantity(item.menuItem.id, item.quantity - 1)}
                  className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-200"
                >
                  &#8722;
                </button>
                <span className="font-semibold w-8 text-center">{item.quantity}</span>
                <button
                  onClick={() => onUpdateQuantity(item.menuItem.id, item.quantity + 1)}
                  className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-200"
                >
                  +
                </button>
                <span className="ml-auto font-semibold">
                  {formatPrice(item.menuItem.price * item.quantity * taxMultiplier)}
                </span>
              </div>

              <input
                type="text"
                value={item.notes}
                onChange={(e) => onUpdateNotes(item.menuItem.id, e.target.value)}
                placeholder={t('orders.specialRequestsShort')}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500"
                maxLength={200}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
