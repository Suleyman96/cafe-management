'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
import * as Sentry from '@sentry/nextjs';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useAddOrderItems, useCreateOrder, useOrder } from '@/hooks/use-order';
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
  const { items, updateQuantity, updateNotes, removeItem, clearCart, getTotal } = useCartStore();
  const [orderNotes, setOrderNotes] = useState('');
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<Record<string, string>>({});

  const { data: table } = useTable(tableId);
  const actualTableId = table?.id || '';
  const { data: existingOrder } = useOrder(actualTableId);
  const createOrder = useCreateOrder();
  const addOrderItems = useAddOrderItems();

  const { data: settings } = useCafeSettings();
  const formatPrice = useFormatPrice();
  const taxMultiplier = useTaxMultiplier();

  const cartSubtotal = getTotal();
  const total = cartSubtotal * taxMultiplier;

  const minimumOrderMet = !settings?.minimum_order_amount || total >= settings.minimum_order_amount;

  const handlePlaceOrder = async () => {
    if (items.length === 0 || !actualTableId) return;

    if (settings?.minimum_order_amount && total < settings.minimum_order_amount) {
      const minAmount =
        settings.currency_position === 'before'
          ? `${settings.currency_symbol}${settings.minimum_order_amount.toFixed(settings.currency_decimal_places)}`
          : `${settings.minimum_order_amount.toFixed(settings.currency_decimal_places)}${settings.currency_symbol}`;
      toast.error(t('cart.minimumOrderToast', { amount: minAmount }));
      return;
    }

    try {
      const tenantId = table?.tenant_id;
      if (!tenantId) throw new Error('Missing tenant context');

      let orderId = existingOrder?.id;

      if (!orderId) {
        const newOrder = await createOrder.mutateAsync({
          tableId: actualTableId,
          notes: orderNotes,
          tenantId,
        });
        orderId = newOrder.id;
      }

      await addOrderItems.mutateAsync({
        orderId,
        tenantId,
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
      router.push(`/table/${tableId}/order`);
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t('cart.orderError'));
    }
  };

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

  const isLoading = createOrder.isPending || addOrderItems.isPending;

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
              onEditNotes={(id, notes) => {
                setEditingNotes(id);
                setTempNotes({ ...tempNotes, [id]: notes });
              }}
              onCancelEditNotes={(id) => {
                setEditingNotes(null);
                const { [id]: _, ...rest } = tempNotes;
                setTempNotes(rest);
              }}
              onSaveNotes={(id, notes) => {
                updateNotes(id, notes);
                setEditingNotes(null);
                const { [id]: _, ...rest } = tempNotes;
                setTempNotes(rest);
              }}
              onTempNotesChange={(id, value) => setTempNotes({ ...tempNotes, [id]: value })}
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
        isLoading={isLoading}
        onPlaceOrder={handlePlaceOrder}
        placeOrderLabel={t('cart.placeOrder', { price: formatPrice(total) })}
        formatPrice={formatPrice}
      />
    </div>
  );
}
