'use client';

import type { Database } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
import { Check, Loader2, Minus, Plus, ShoppingCart } from 'lucide-react';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];

type CartItem = {
  menuItem: MenuItem;
  quantity: number;
};

interface TableCartProps {
  cart: CartItem[];
  activeOrder: any;
  selectedOrderIndex: number;
  submitting: boolean;
  orderNotes: string;
  cartTotal: number;
  taxMultiplier: number;
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
  taxMultiplier,
  formatPrice,
  onAddToCart,
  onRemoveFromCart,
  onSetOrderNotes,
  onSubmit,
}: TableCartProps) {
  const { t } = useTranslation('staff');

  return (
    <div className="lg:col-span-1 order-1 lg:order-2">
      <div className="border rounded-lg p-3 sm:p-4 lg:sticky lg:top-4 bg-white">
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          {activeOrder ? t('orders.addItems') : t('orders.new')} (
          {cart.reduce((sum, item) => sum + item.quantity, 0)})
        </h2>

        {cart.length === 0 ? (
          <p className="text-gray-500 text-center py-8">{t('orders.clickToAdd')}</p>
        ) : (
          <>
            <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
              {cart.map((item) => (
                <div
                  key={item.menuItem.id}
                  className="flex items-center justify-between border-b pb-3"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.menuItem.name}</p>
                    <p className="text-sm text-gray-600">
                      {formatPrice(item.menuItem.price * taxMultiplier)} x {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFromCart(item.menuItem.id);
                      }}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToCart(item.menuItem);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Notes */}
            <div className="mb-4">
              <textarea
                value={orderNotes}
                onChange={(e) => onSetOrderNotes(e.target.value)}
                placeholder={t('orders.customerNotesPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
                rows={2}
              />
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-4">
                <span className="font-semibold">{t('total', { ns: 'common' })}</span>
                <span className="font-semibold text-lg">{formatPrice(cartTotal)}</span>
              </div>
              <Button
                className="w-full"
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
          </>
        )}
      </div>
    </div>
  );
}
