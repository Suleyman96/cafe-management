'use client';

import { useTranslation } from '@gustri/i18n';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useAddOrderItems, useCreateOrder, useOrder } from '@/hooks/use-order';
import {
  calculateTax,
  calculateTotal,
  getDisplaySubtotal,
  useCafeSettings,
} from '@/hooks/use-settings';
import { useTable } from '@/hooks/use-table';
import {
  accentButtonStyle,
  glassBorderStyle,
  glassCardStyle,
  glassControlStyle,
} from '@/lib/styles';
import { useCartStore } from '@/store/cart-store';

interface MenuCartSidebarProps {
  tableId: string;
  accentColor: string;
  onOrderPlaced?: () => void;
}

export function MenuCartSidebar({ tableId, accentColor, onOrderPlaced }: MenuCartSidebarProps) {
  const router = useRouter();
  const { t } = useTranslation('customer');
  const { items, updateQuantity, removeItem, clearCart, getTotal } = useCartStore();
  const [orderNotes, setOrderNotes] = useState('');

  const { data: table } = useTable(tableId);
  const actualTableId = table?.id || '';
  const { data: existingOrder } = useOrder(actualTableId);
  const createOrder = useCreateOrder();
  const addOrderItems = useAddOrderItems();
  const { data: settings } = useCafeSettings();

  const cartSubtotal = getTotal();
  const displaySubtotal = settings ? getDisplaySubtotal(cartSubtotal, settings) : cartSubtotal;
  const tax = settings ? calculateTax(cartSubtotal, settings) : 0;
  const total = settings ? calculateTotal(cartSubtotal, settings) : cartSubtotal;
  const minimumOrderMet = !settings?.minimum_order_amount || total >= settings.minimum_order_amount;

  const priceDisplay = useFormatPrice();

  const handlePlaceOrder = async () => {
    if (items.length === 0 || !actualTableId) return;

    if (settings?.minimum_order_amount && total < settings.minimum_order_amount) {
      const minAmount = priceDisplay(settings.minimum_order_amount);
      toast.error(t('cart.minimumOrderToast', { amount: minAmount }));
      return;
    }

    try {
      let orderId = existingOrder?.id;

      if (!orderId) {
        const newOrder = await createOrder.mutateAsync({
          tableId: actualTableId,
          notes: orderNotes,
        });
        orderId = newOrder.id;
      }

      await addOrderItems.mutateAsync({
        orderId,
        items: items.map((item) => ({
          menu_item_id: item.menuItem.id,
          item_name: item.menuItem.name,
          item_price: item.menuItem.price,
          quantity: item.quantity,
          notes: item.notes,
        })),
      });

      toast.success(t('cart.orderSuccess'));
      clearCart();
      onOrderPlaced?.();
      router.push(`/table/${tableId}/order`);
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error(t('cart.orderError'));
    }
  };

  const isPlacing = createOrder.isPending || addOrderItems.isPending;

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="text-4xl mb-3">🛒</div>
        <p className="text-sm font-medium text-white/60 mb-1">{t('cart.emptyTitle')}</p>
        <p className="text-xs text-white/30">
          {existingOrder ? t('cart.emptyWithOrder') : t('cart.emptyNoOrder')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-white">{t('cart.header')}</h2>
        <button
          onClick={clearCart}
          className="text-[11px] font-medium text-red-400/80 hover:text-red-400 transition-colors"
        >
          {t('cart.clearButton')}
        </button>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2 scrollbar-hide">
        {items.map((item) => {
          const name = item.menuItem.name;
          return (
            <div key={item.menuItem.id} className="rounded-xl p-3" style={glassCardStyle}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-white truncate">{name}</h4>
                  <p className="text-[11px] text-white/30">{priceDisplay(item.menuItem.price)}</p>
                </div>
                <button
                  onClick={() => removeItem(item.menuItem.id)}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all ml-2"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              {item.notes && (
                <p className="text-[10px] text-white/30 mb-2 truncate">📝 {item.notes}</p>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
                    className="flex h-6 w-6 items-center justify-center rounded-lg transition-all active:scale-95"
                    style={glassControlStyle}
                  >
                    <Minus className="h-3 w-3 text-white/60" />
                  </button>
                  <span className="text-xs font-bold text-white w-5 text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                    className="flex h-6 w-6 items-center justify-center rounded-lg transition-all active:scale-95"
                    style={glassControlStyle}
                  >
                    <Plus className="h-3 w-3 text-white/60" />
                  </button>
                </div>
                <span className="text-xs font-bold" style={{ color: accentColor }}>
                  {priceDisplay(item.menuItem.price * item.quantity)}
                </span>
              </div>
            </div>
          );
        })}

        {/* Order Notes */}
        {settings?.allow_order_notes !== false && (
          <div className="pt-2 pb-1">
            <textarea
              className="w-full min-h-[56px] p-2.5 rounded-xl text-xs text-white placeholder:text-white/20 focus:outline-none resize-none"
              style={glassCardStyle}
              placeholder={t('cart.orderNotesPlaceholder')}
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Price Summary + Place Order */}
      <div className="px-4 pt-3 pb-4" style={glassBorderStyle}>
        <div className="space-y-1.5 mb-3">
          {settings?.tax_enabled && settings?.show_tax_separately ? (
            <>
              <div className="flex justify-between text-[11px]">
                <span className="text-white/40">{t('subtotal', { ns: 'common' })}</span>
                <span className="text-white/60">{priceDisplay(displaySubtotal)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-white/40">
                  {settings.tax_label} ({settings.tax_percentage}%)
                </span>
                <span className="text-white/60">{priceDisplay(tax)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-2" style={glassBorderStyle}>
                <span className="text-white">{t('total', { ns: 'common' })}</span>
                <span style={{ color: accentColor }}>{priceDisplay(total)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-sm font-bold">
              <span className="text-white">{t('total', { ns: 'common' })}</span>
              <span style={{ color: accentColor }}>{priceDisplay(total)}</span>
            </div>
          )}
        </div>

        {/* Minimum Order Warning */}
        {settings?.minimum_order_amount && !minimumOrderMet && (
          <div
            className="mb-3 p-2 rounded-lg text-center"
            style={{
              background: 'rgba(234,179,8,0.08)',
              border: '1px solid rgba(234,179,8,0.15)',
            }}
          >
            <p className="text-[11px] text-yellow-400/80">
              {t('cart.minimumOrder', { amount: priceDisplay(settings.minimum_order_amount) })}
            </p>
          </div>
        )}

        <button
          onClick={handlePlaceOrder}
          disabled={isPlacing || !minimumOrderMet}
          className="w-full rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
          style={accentButtonStyle(accentColor)}
        >
          {isPlacing ? '...' : t('cart.placeOrder', { price: priceDisplay(total) })}
        </button>
      </div>
    </div>
  );
}
