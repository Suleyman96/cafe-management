'use client';

import type { Database } from '@gustri/database/types';
import { Minus, Plus } from 'lucide-react';

type OrderItem = Database['public']['Tables']['order_items']['Row'] & {
  menu_item?: Database['public']['Tables']['menu_items']['Row'];
};

interface ItemPaymentFormProps {
  unpaidItems: OrderItem[];
  selectedItemQuantities: Map<string, number>;
  onUpdateQuantity: (itemId: string, maxQty: number, delta: number) => void;
  selectedItemsTotal: number;
  hasSelectedItems: boolean;
  formatPrice: (amount: number) => string;
  t: (key: string, opts?: Record<string, string | number>) => string;
}

export function ItemPaymentForm({
  unpaidItems,
  selectedItemQuantities,
  onUpdateQuantity,
  selectedItemsTotal,
  hasSelectedItems,
  formatPrice,
  t,
}: ItemPaymentFormProps) {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {t('payment.selectItemsToPay')}
      </label>
      <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3">
        {unpaidItems.map((item: OrderItem) => {
          const selectedQty = selectedItemQuantities.get(item.id) || 0;
          const isSelected = selectedQty > 0;

          return (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-2 rounded transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
            >
              <div className="flex-1">
                <div className="font-medium text-sm">
                  {item.quantity}x {item.item_name}
                </div>
                {item.notes && <div className="text-xs text-gray-500">{item.notes}</div>}
                <div className="text-xs text-gray-500">
                  {formatPrice(item.item_price)} {t('payment.each')}
                </div>
              </div>

              {/* Quantity selector */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onUpdateQuantity(item.id, item.quantity, -1)}
                  disabled={selectedQty <= 0}
                  className="h-7 w-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-medium">{selectedQty}</span>
                <button
                  onClick={() => onUpdateQuantity(item.id, item.quantity, 1)}
                  disabled={selectedQty >= item.quantity}
                  className="h-7 w-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="font-medium text-sm w-20 text-right">
                {isSelected
                  ? formatPrice(selectedQty * item.item_price)
                  : formatPrice(item.quantity * item.item_price)}
              </div>
            </div>
          );
        })}
      </div>
      {hasSelectedItems && (
        <div className="mt-2">
          <div className="text-sm font-medium text-blue-700">
            {t('total', { ns: 'common' })}: {formatPrice(selectedItemsTotal)}
          </div>
        </div>
      )}
    </div>
  );
}
