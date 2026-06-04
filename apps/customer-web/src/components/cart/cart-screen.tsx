'use client';

import { isAppError } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui-web';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ActiveOrderBanner } from '@/components/order/active-order-banner';
import { TableNotActiveScreen } from '@/components/table/table-not-active-screen';
import { useCartItemNotes } from '@/hooks/use-cart-item-notes';
import { useCartMenuSync } from '@/hooks/use-cart-menu-sync';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useOrder } from '@/hooks/use-order';
import { useOrderEta } from '@/hooks/use-order-eta';
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
  // P6 — per-field selectors so we only re-render when the slice this
  // screen actually reads changes. Pre-fix the destructured-store form
  // re-rendered every consumer on any cart mutation; adding one item
  // re-flowed the entire menu grid behind us.
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const getTotal = useCartStore((s) => s.getTotal);

  // H3 — last-line defense against stale-cart items reaching the place
  // order flow. Runs whenever this screen is mounted; if the live menu
  // dropped an item since rehydrate the cart purges it with a toast.
  useCartMenuSync();
  const [orderNotes, setOrderNotes] = useState('');
  const {
    editingNotes,
    tempNotes,
    onEditNotes,
    onCancelEditNotes,
    onSaveNotes,
    onTempNotesChange,
  } = useCartItemNotes();

  const { data: table, error: tableError } = useTable(tableId);
  const actualTableId = table?.id || '';
  const { data: existingOrder } = useOrder(actualTableId);
  // M5 — feed the active-order banner's ETA chip. `useOrderEta` returns
  // null whenever any contributing item lacks `preparation_time` or the
  // order is in a terminal state, so the banner falls back to the
  // generic "View active order" copy without surfacing a stale ETA.
  const activeOrderEta = useOrderEta(
    existingOrder?.order_items,
    existingOrder?.status,
    existingOrder?.created_at,
    existingOrder?.id,
  );
  // H5 — staff renamed / deleted this table mid-session; show the
  // explicit recovery screen instead of the empty-cart placeholder.
  const tableNotFound = isAppError(tableError) && tableError.code === 'NOT_FOUND';

  const { data: settings } = useCafeSettings();
  const formatPrice = useFormatPrice();
  const taxMultiplier = useTaxMultiplier();

  const cartSubtotal = getTotal();
  const total = cartSubtotal * taxMultiplier;

  const minimumOrderMet = !settings?.minimum_order_amount || total >= settings.minimum_order_amount;

  const { handlePlaceOrder, isPlacing, submittedByOtherTab } = usePlaceOrder({
    tableId,
    minimumOrderAmount: settings?.minimum_order_amount,
    orderNotes,
    total,
  });

  if (tableNotFound) {
    return <TableNotActiveScreen />;
  }

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
            <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
          </Button>
          <h1 className="text-xl font-bold">{t('cart.header')}</h1>
          <Button variant="ghost" size="sm" onClick={clearCart} className="text-destructive">
            {t('cart.clearButton')}
          </Button>
        </div>
      </div>

      <div className="p-4">
        {/* M5 — active-order banner. Tells the customer their next
            Place Order tap will *append* to the in-flight order, not
            start a duplicate. The Place Order button label below also
            flips to "Add to order #A123" to reinforce the intent. */}
        {existingOrder?.order_number && (
          <div className="mb-4">
            <ActiveOrderBanner
              orderNumber={existingOrder.order_number}
              href={`/table/${tableId}/order`}
              eta={activeOrderEta}
            />
          </div>
        )}

        {/* Cart Items */}
        <div className="space-y-4 mb-6">
          {items.map((item) => (
            <CartItemCard
              key={item.lineKey}
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
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
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
        placeOrderLabel={
          existingOrder?.order_number
            ? t('cart.addToOrder', {
                orderNumber: existingOrder.order_number,
                price: formatPrice(total),
              })
            : t('cart.placeOrder', { price: formatPrice(total) })
        }
        submittedByOtherTab={submittedByOtherTab}
      />
    </div>
  );
}
