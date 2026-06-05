'use client';

import { DEFAULT_TAX_PERCENTAGE } from '@gustri/core';
import type { Database } from '@gustri/database/types';
import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui-web';
import { Check, Loader2, Minus, Plus, ShoppingCart } from 'lucide-react';
import { useCafeSettings, useTaxMultiplier } from '@/hooks';
import type { OrderWithDetails } from '@/types';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];

type CartItem = {
  menuItem: MenuItem;
  quantity: number;
};

interface TableCartProps {
  cart: CartItem[];
  activeOrder: OrderWithDetails | undefined;
  selectedOrderIndex: number;
  submitting: boolean;
  orderNotes: string;
  cartTotal: number;
  formatPrice: (amount: number) => string;
  onAddToCart: (menuItem: MenuItem) => void;
  onRemoveFromCart: (menuItemId: string) => void;
  onSetOrderNotes: (notes: string) => void;
  onSubmit: () => void;
}

export function TableCart({
  cart,
  activeOrder,
  selectedOrderIndex,
  submitting,
  orderNotes,
  cartTotal,
  formatPrice,
  onAddToCart,
  onRemoveFromCart,
  onSetOrderNotes,
  onSubmit,
}: TableCartProps) {
  const { t } = useTranslation('staff');
  const taxMultiplier = useTaxMultiplier();
  const { data: cafeSettings } = useCafeSettings();

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (cart.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col h-full border-t bg-white">
      {/* Cart header */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b bg-gray-50">
        <ShoppingCart className="h-4 w-4 text-blue-600" />
        <span className="font-semibold text-sm">
          {activeOrder ? t('orders.addItems') : t('orders.new')}
        </span>
        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">
          {itemCount}
        </span>
      </div>

      {/* Cart items — scrollable, padded for fixed footer */}
      <div className="flex-1 overflow-y-auto px-4 py-2 pb-16">
        <div className="space-y-1">
          {cart.map((item) => (
            <div
              key={item.menuItem.id}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.menuItem.name}</p>
                <p className="text-xs text-gray-500">
                  {formatPrice(item.menuItem.price * taxMultiplier)} x {item.quantity}
                </p>
              </div>
              <div className="flex items-center gap-1.5 ml-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFromCart(item.menuItem.id);
                  }}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToCart(item.menuItem);
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Order Notes */}
        <textarea
          value={orderNotes}
          onChange={(e) => onSetOrderNotes(e.target.value)}
          placeholder={t('orders.customerNotesPlaceholder')}
          className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
          rows={2}
        />
      </div>

      {/* Total + Submit — fixed at viewport bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t px-4 py-3 bg-white shadow-lg">
        <div className="flex items-center justify-between max-w-screen-xl mx-auto">
          <div>
            <span className="font-semibold text-lg">{formatPrice(cartTotal * taxMultiplier)}</span>
            {taxMultiplier !== 1 && (
              <p className="text-xs text-gray-400">
                {t('orders.inclTax', {
                  percent: String(cafeSettings?.tax_percentage ?? DEFAULT_TAX_PERCENTAGE),
                })}
              </p>
            )}
          </div>
          <Button
            data-testid="submit-order"
            onClick={onSubmit}
            disabled={submitting || cart.length === 0}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {activeOrder ? t('orders.adding') : t('orders.creating')}
              </>
            ) : activeOrder ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                {t('orders.addToOrder')} #{selectedOrderIndex + 1}
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                {t('orders.createOrder')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
