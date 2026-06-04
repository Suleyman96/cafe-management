'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui-web';
import * as Sentry from '@sentry/nextjs';
import { ArrowLeft, Edit3, MapPin, Phone, Truck, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCartItemNotes } from '@/hooks/use-cart-item-notes';
import { useCartMenuSync } from '@/hooks/use-cart-menu-sync';
import { useCrossTabPlaceOrderKeys } from '@/hooks/use-cross-tab-place-order-keys';
import { useAddDeliveryOrderItems, useCreateDeliveryOrder } from '@/hooks/use-delivery';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useCafeSettings } from '@/hooks/use-settings';
import { useTaxMultiplier } from '@/hooks/use-tax-multiplier';
import { writeDeliveryOrderToken } from '@/lib/delivery-order-token-storage';
import { useCartStore } from '@/store/cart-store';
import { useDeliveryStore } from '@/store/delivery-store';
import { useOrderConfirmationStore } from '@/store/order-confirmation-store';
import { CartItemCard } from './cart-item-card';
import { CartPriceSummary } from './cart-price-summary';

export function DeliveryCartScreen() {
  const router = useRouter();
  const { t } = useTranslation('customer');
  // P6 — per-field selectors so the screen only re-renders when the
  // slice it reads changes.
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const getTotal = useCartStore((s) => s.getTotal);
  const getItemCount = useCartStore((s) => s.getItemCount);

  // H3 — same stale-cart audit as the dine-in cart screen. The delivery
  // menu's `is_available` toggle is the same data source, so the same
  // prune fits here.
  useCartMenuSync();
  const {
    customerName,
    customerPhone,
    deliveryAddress,
    deliveryNotes,
    qrToken,
    setLastOrderId,
    clearCustomerInfo,
    clearQrToken,
  } = useDeliveryStore();
  const showConfirmation = useOrderConfirmationStore((s) => s.show);
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
  // C1 / H4 — cross-tab-aware idempotency keys. Two tabs of the same
  // delivery QR (same `qrToken`) would previously mint independent
  // `client_request_id`s and produce two orders if the customer tapped
  // Place Order in both. The cross-tab hook persists the keys to
  // localStorage under `delivery:${qrToken}` so every same-origin tab
  // reuses the same id; the `storage` event also surfaces a sibling
  // tab's successful submit so this tab's button can switch to a
  // "submitted in another tab" state instead of hitting the dedup-
  // reject path. Falls back to `delivery:none` while the QR token
  // hasn't been captured yet (the handler short-circuits in that case
  // anyway via the missingQrToken guard below).
  const placeOrderKeys = useCrossTabPlaceOrderKeys(`delivery:${qrToken || 'none'}`);
  const submittedByOtherTab = placeOrderKeys.submittedByOtherTab;

  const cartSubtotal = getTotal();
  const deliveryFee = settings?.delivery_fee_default ?? 0;
  const foodTotal = cartSubtotal * taxMultiplier;
  const grandTotal = foodTotal + deliveryFee;

  const minimumMet =
    !settings?.minimum_delivery_amount || foodTotal >= settings.minimum_delivery_amount;

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;
    // H4 — defense-in-depth: even with the button disabled, a
    // programmatic re-trigger (testing, accidental focus + Enter on a
    // sibling control) shouldn't proceed past a sibling-tab submit.
    if (submittedByOtherTab) {
      toast.error(t('cart.submittedInOtherTab'));
      return;
    }

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
        client_request_id: placeOrderKeys.getOrderKey(),
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
          // lineKey, not menuItem.id — distinct modifier combos must not
          // collide on the (tenant_id, client_request_id) unique index.
          client_request_id: placeOrderKeys.getItemKey(item.lineKey),
          selected_options: (item.selectedOptions ?? []).map((o) => ({
            option_id: o.optionId,
            value_id: o.valueId,
          })),
        })),
      });

      // H4 — broadcast the consumed lock to sibling tabs. Overwrites
      // the partition entry with `{ submittedAt }`; sibling tabs'
      // storage listener flips `submittedByOtherTab`.
      placeOrderKeys.markSubmitted();

      setLastOrderId(order.id);
      // S3 — persist the access_token to sessionStorage so the tracking
      // page can recover it if the customer manually clears the URL bar
      // or the fragment gets stripped by a share/copy-link surface. The
      // helper wraps the value in `{ token, ts }` so a 24 h TTL sweep on
      // the tracking page can prune stale bearers from long-running tabs.
      // sessionStorage (NOT localStorage) so the bearer dies with the
      // tab — cross-tab persistence isn't useful here and shared-device
      // residue stays minimal.
      if (order.delivery_access_token) {
        writeDeliveryOrderToken(order.id, order.delivery_access_token);
      }
      // M1 — confirmation overlay owns the navigation timing. Capture
      // item count BEFORE clearCart so the overlay can render the
      // snapshot. Token stays in the URL fragment (M1, plans/17) — the
      // overlay just embeds it in the trackHref so the auto-navigate /
      // Track Order tap lands with the bearer still attached.
      const itemCount = getItemCount();
      showConfirmation({
        orderNumber: order.order_number ?? '',
        itemCount,
        total: grandTotal,
        flow: 'delivery',
        trackHref: `/delivery/order/${order.id}#token=${order.delivery_access_token}`,
      });
      clearCart();
      // S1 / S2 — wipe PII and bearer AFTER the confirmation overlay has
      // captured what it needs. Calls are placed here (not earlier in the
      // try block) so a failed order keeps the form pre-filled for retry.
      // `lastOrderId` and the access_token survive: the former drives the
      // confirmation-overlay snapshot, the latter is read from the URL
      // fragment (and sessionStorage above) on the tracking page.
      clearCustomerInfo();
      clearQrToken();
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
            <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
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
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
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
        submittedByOtherTab={submittedByOtherTab}
      />
    </div>
  );
}
