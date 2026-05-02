'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
import * as Sentry from '@sentry/nextjs';
import { ArrowLeft, Edit3, MapPin, Phone, Truck, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCartItemNotes } from '@/hooks/use-cart-item-notes';
import { useAddDeliveryOrderItems, useCreateDeliveryOrder } from '@/hooks/use-delivery';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useCafeSettings } from '@/hooks/use-settings';
import { useTaxMultiplier } from '@/hooks/use-tax-multiplier';
import { useCartStore } from '@/store/cart-store';
import { useDeliveryStore } from '@/store/delivery-store';
import { CartItemCard } from './cart-item-card';
import { CartPriceSummary } from './cart-price-summary';

export function DeliveryCartScreen() {
  const router = useRouter();
  const { t } = useTranslation('customer');
  const { items, updateQuantity, removeItem, clearCart, getTotal } = useCartStore();
  const { customerName, customerPhone, deliveryAddress, deliveryNotes, qrToken, setLastOrderId } =
    useDeliveryStore();
  const [orderNotes, setOrderNotes] = useState('');
  const {
    editingNotes,
    tempNotes,
    onEditNotes,
    onCancelEditNotes,
    onSaveNotes,
    onTempNotesChange,
  } = useCartItemNotes();

  const createDeliveryOrder = useCreateDeliveryOrder();
  const addDeliveryOrderItems = useAddDeliveryOrderItems();
  const { data: settings } = useCafeSettings();
  const formatPrice = useFormatPrice();
  const taxMultiplier = useTaxMultiplier();

  const cartSubtotal = getTotal();
  const deliveryFee = settings?.delivery_fee_default ?? 0;
  const foodTotal = cartSubtotal * taxMultiplier;
  const grandTotal = foodTotal + deliveryFee;

  const minimumMet =
    !settings?.minimum_delivery_amount || foodTotal >= settings.minimum_delivery_amount;

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;

    if (!minimumMet) {
      toast.error(
        t('deliveryCart.minimumDeliveryToast', {
          amount: formatPrice(settings?.minimum_delivery_amount || 0),
        }),
      );
      return;
    }

    try {
      // C1: tenant binding is derived server-side from `qrToken`. The
      // bearer secret is captured on the delivery landing page from
      // `?token=…` and persisted in the delivery store.
      if (!qrToken) {
        toast.error(t('deliveryCart.missingQrToken'));
        return;
      }

      const order = await createDeliveryOrder.mutateAsync({
        customerName,
        customerPhone,
        deliveryAddress,
        deliveryNotes,
        deliveryFee,
        orderNotes,
        qrToken,
      });

      // The items route still needs a tenant scope; derive it from the
      // persisted order rather than recomputing it client-side.
      const tenantId = order.tenant_id;
      if (!tenantId) throw new Error('Missing tenant context');

      await addDeliveryOrderItems.mutateAsync({
        orderId: order.id,
        tenantId,
        items: items.map((item) => ({
          menu_item_id: item.menuItem.id,
          item_name: item.menuItem.name,
          item_price: item.menuItem.price,
          quantity: item.quantity,
          notes: item.notes,
        })),
      });

      setLastOrderId(order.id);
      toast.success(t('deliveryCart.orderSuccess'));
      clearCart();
      router.push(`/delivery/order/${order.id}?token=${order.delivery_access_token}`);
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t('deliveryCart.orderError'));
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">{t('deliveryCart.emptyTitle')}</h1>
          <p className="text-muted-foreground">{t('deliveryCart.emptySubtext')}</p>
        </div>
        <Button size="lg" onClick={() => router.push('/delivery/menu')}>
          {t('cart.browseMenu')}
        </Button>
      </div>
    );
  }

  const isLoading = createDeliveryOrder.isPending || addDeliveryOrderItems.isPending;

  return (
    <div className="min-h-screen bg-background pb-48">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">{t('deliveryCart.header')}</h1>
          <Button variant="ghost" size="sm" onClick={clearCart} className="text-destructive">
            {t('deliveryCart.clearButton')}
          </Button>
        </div>
      </div>

      <div className="p-4">
        {/* Delivery Info Summary */}
        <div className="bg-card rounded-lg p-4 border mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Truck className="h-4 w-4" />
              {t('deliveryCart.deliveryDetails')}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => router.push('/delivery')}>
              <Edit3 className="h-3 w-3 mr-1" />
              {t('deliveryCart.editButton')}
            </Button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{customerName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{customerPhone}</span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
              <span>{deliveryAddress}</span>
            </div>
            {deliveryNotes && <p className="text-muted-foreground pl-5">{deliveryNotes}</p>}
          </div>
        </div>

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
              priceLabel={`${formatPrice(item.menuItem.price * taxMultiplier)} ${t('each', { ns: 'common' })}`}
            />
          ))}
        </div>

        {/* Order Notes */}
        {settings?.allow_order_notes !== false && (
          <div className="mb-6">
            <label className="text-sm font-medium mb-2 block">{t('deliveryCart.orderNotes')}</label>
            <textarea
              className="w-full min-h-[80px] p-3 rounded-md border border-input bg-background"
              placeholder={t('deliveryCart.orderNotesPlaceholder')}
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
            />
          </div>
        )}
      </div>

      <CartPriceSummary
        total={grandTotal}
        taxPercentage={settings?.tax_enabled ? settings.tax_percentage : undefined}
        deliveryFee={deliveryFee}
        minimumAmount={settings?.minimum_delivery_amount ?? undefined}
        minimumMet={minimumMet}
        minimumWarning={
          settings?.minimum_delivery_amount
            ? t('deliveryCart.minimumDelivery', {
                amount: formatPrice(settings.minimum_delivery_amount),
              })
            : undefined
        }
        isLoading={isLoading}
        onPlaceOrder={handlePlaceOrder}
        placeOrderLabel={t('deliveryCart.placeOrder', { price: formatPrice(grandTotal) })}
        formatPrice={formatPrice}
      />
    </div>
  );
}
