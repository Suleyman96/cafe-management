'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useCartItemNotes } from '@/hooks/use-cart-item-notes';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useOrder } from '@/hooks/use-order';
import { usePlaceOrder } from '@/hooks/use-place-order';
import { useCafeSettings } from '@/hooks/use-settings';
import { useTable } from '@/hooks/use-table';
import { useTaxMultiplier } from '@/hooks/use-tax-multiplier';
import { useCartStore } from '@/store/cart-store';
import { CartItemCard } from './cart-item-card';
import { CartPriceSummary } from './cart-price-summary';

interface CartScreenProps {
  tableId: string;
}

export function CartScreen({ tableId }: CartScreenProps) {
  const router = useRouter();
  const { t } = useTranslation('customer');
  const { items, updateQuantity, removeItem, clearCart, getTotal } = useCartStore();
  const [orderNotes, setOrderNotes] = useState('');
  const {
    editingNotes,
    tempNotes,
    onEditNotes,
    onCancelEditNotes,
    onSaveNotes,
    onTempNotesChange,
  } = useCartItemNotes();

  const { data: table } = useTable(tableId);
  const actualTableId = table?.id || '';
  const { data: existingOrder } = useOrder(actualTableId);

  const { data: settings } = useCafeSettings();
  const formatPrice = useFormatPrice();
  const taxMultiplier = useTaxMultiplier();

  const cartSubtotal = getTotal();
  const total = cartSubtotal * taxMultiplier;

  const minimumOrderMet = !settings?.minimum_order_amount || total >= settings.minimum_order_amount;

  const { handlePlaceOrder, isPlacing } = usePlaceOrder({
    tableId,
    minimumOrderAmount: settings?.minimum_order_amount,
    orderNotes,
    total,
  });

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">{t('cart.emptyTitle')}</h1>
          <p className="text-muted-foreground">
            {existingOrder ? t('cart.emptyWithOrder') : t('cart.emptyNoOrder')}
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {existingOrder && (
            <Button
              size="lg"
              onClick={() => router.push(`/table/${tableId}/order`)}
              className="w-full"
            >
              <ClipboardList className="mr-2 h-5 w-5" />
              {t('cart.viewCurrentOrder')}
            </Button>
          )}
          <Button
            size="lg"
            variant={existingOrder ? 'outline' : 'default'}
            onClick={() => router.push(`/table/${tableId}/menu`)}
            className="w-full"
          >
            {existingOrder ? t('cart.addMoreItems') : t('cart.browseMenu')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">{t('cart.header')}</h1>
          <Button variant="ghost" size="sm" onClick={clearCart} className="text-destructive">
            {t('cart.clearButton')}
          </Button>
        </div>
      </div>

      <div className="p-4">
        {/* Cart Items */}
        <div className="space-y-4 mb-6">
          {items.map((item) => (
            <CartItemCard
              key={item.menuItem.id}
              item={item}
              taxMultiplier={taxMultiplier}
              allowItemNotes={settings?.allow_item_notes !== false}
              editingNotes={editingNotes}
              tempNotes={tempNotes}
              onEditNotes={onEditNotes}
              onCancelEditNotes={onCancelEditNotes}
              onSaveNotes={onSaveNotes}
              onTempNotesChange={onTempNotesChange}
              onRemoveItem={removeItem}
              onUpdateQuantity={updateQuantity}
              formatPrice={formatPrice}
              priceLabel={t('cart.priceEach', {
                price: formatPrice(item.menuItem.price * taxMultiplier),
              })}
            />
          ))}
        </div>

        {/* Order Notes */}
        {settings?.allow_order_notes !== false && (
          <div className="mb-6">
            <label className="text-sm font-medium mb-2 block">{t('cart.orderNotes')}</label>
            <textarea
              className="w-full min-h-[80px] p-3 rounded-md border border-input bg-background"
              placeholder={t('cart.orderNotesPlaceholder')}
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
            />
          </div>
        )}
      </div>

      <CartPriceSummary
        total={total}
        taxPercentage={settings?.tax_enabled ? settings.tax_percentage : undefined}
        minimumAmount={settings?.minimum_order_amount}
        minimumMet={minimumOrderMet}
        minimumWarning={
          settings?.minimum_order_amount
            ? t('cart.minimumOrder', {
                amount:
                  settings.currency_position === 'before'
                    ? `${settings.currency_symbol}${settings.minimum_order_amount.toFixed(settings.currency_decimal_places)}`
                    : `${settings.minimum_order_amount.toFixed(settings.currency_decimal_places)}${settings.currency_symbol}`,
              })
            : undefined
        }
        isLoading={isPlacing}
        onPlaceOrder={handlePlaceOrder}
        placeOrderLabel={t('cart.placeOrder', { price: formatPrice(total) })}
        formatPrice={formatPrice}
      />
    </div>
  );
}
