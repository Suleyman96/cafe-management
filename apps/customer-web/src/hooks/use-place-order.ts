import { useTranslation } from '@gustri/i18n';
import * as Sentry from '@sentry/nextjs';
import { toast } from 'sonner';
import { useCrossTabPlaceOrderKeys } from '@/hooks/use-cross-tab-place-order-keys';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useAddOrderItems, useCreateOrder, useOrder } from '@/hooks/use-order';
import { useTable } from '@/hooks/use-table';
import { useCartStore } from '@/store/cart-store';
import { useOrderConfirmationStore } from '@/store/order-confirmation-store';

interface UsePlaceOrderOptions {
  tableId: string;
  minimumOrderAmount?: number;
  orderNotes?: string;
  total: number;
  onOrderPlaced?: () => void;
}

export function usePlaceOrder({
  tableId,
  minimumOrderAmount,
  orderNotes,
  total,
  onOrderPlaced,
}: UsePlaceOrderOptions) {
  const { t } = useTranslation('customer');
  // P6 — per-field selectors so consumers of this hook (cart-screen,
  // menu-cart-sidebar) don't re-render on cart store mutations they
  // don't read.
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const getItemCount = useCartStore((s) => s.getItemCount);
  const formatPrice = useFormatPrice();
  const showConfirmation = useOrderConfirmationStore((s) => s.show);

  const { data: table } = useTable(tableId);
  const actualTableId = table?.id || '';
  const { data: existingOrder } = useOrder(actualTableId);
  const createOrder = useCreateOrder();
  const addOrderItems = useAddOrderItems();

  // C1 / H4 — cross-tab-aware idempotency keys. The prior implementation
  // (`useStableClientRequestId` + a per-component ref Map) survived
  // single-tab retries via the `(tenant_id, client_request_id)` partial
  // unique indexes on `orders` / `order_items`, but two tabs of the same
  // cart minted independent keys and the dedup index never saw across
  // them. The cross-tab hook persists the keys to localStorage under
  // `dine_in:${tableId}` so every same-origin tab reuses the same id;
  // it also exposes `submittedByOtherTab` (driven by a `storage` event)
  // so the cart UI in a sibling tab can disable Place Order rather than
  // hitting the dedup-reject path. Keys live in the hook (not in either
  // call site) so both `cart-screen.tsx` and `menu-cart-sidebar.tsx`
  // share one source of truth.
  const placeOrderKeys = useCrossTabPlaceOrderKeys(`dine_in:${tableId}`);

  const isPlacing = createOrder.isPending || addOrderItems.isPending;

  const handlePlaceOrder = async () => {
    if (items.length === 0 || !actualTableId) return;
    // H4 — gate the same handler so a programmatic re-tap in a sibling
    // tab (after the storage event fired) also no-ops. The UI button is
    // already disabled, but defense-in-depth.
    if (placeOrderKeys.submittedByOtherTab) {
      toast.error(t('cart.submittedInOtherTab'));
      return;
    }

    if (minimumOrderAmount && total < minimumOrderAmount) {
      const minAmount = formatPrice(minimumOrderAmount);
      toast.error(t('cart.minimumOrderToast', { amount: minAmount }));
      return;
    }

    try {
      // The dine_in path no longer sends `tenant_id` in the create body
      // (C1) — staff-web derives it from `table_id`. The items route
      // still needs a tenant scope; derive it from the persisted order
      // itself rather than trusting the table row we read on the
      // client.
      let orderId = existingOrder?.id;
      let tenantId = existingOrder?.tenant_id;
      let orderNumber = existingOrder?.order_number ?? '';

      if (!orderId) {
        const newOrder = await createOrder.mutateAsync({
          tableId: actualTableId,
          notes: orderNotes,
          client_request_id: placeOrderKeys.getOrderKey(),
        });
        orderId = newOrder.id;
        tenantId = newOrder.tenant_id;
        orderNumber = newOrder.order_number ?? orderNumber;
      }

      if (!tenantId) throw new Error('Missing tenant context');

      await addOrderItems.mutateAsync({
        orderId,
        tenantId,
        items: items.map((item) => ({
          menu_item_id: item.menuItem.id,
          item_name: item.menuItem.name,
          item_price: item.menuItem.price,
          quantity: item.quantity,
          notes: item.notes,
          client_request_id: placeOrderKeys.getItemKey(item.menuItem.id),
        })),
      });

      // H4 — broadcast the consumed lock to sibling tabs. Overwrites the
      // stored entry with `{ submittedAt }` so future submits in *this*
      // partition mint a fresh key (the orderKey/itemKeys are gone), and
      // sibling tabs' `storage` listener flips `submittedByOtherTab` so
      // they gate their own Place Order button.
      placeOrderKeys.markSubmitted();

      // M1 — show the confirmation overlay synchronously. The overlay
      // owns the navigation timing: the customer taps Track Order or
      // the auto-dismiss fires at 8s. We capture the item count BEFORE
      // `clearCart()` since the overlay reads from primitive state, not
      // the (now empty) store.
      const itemCount = getItemCount();
      showConfirmation({
        orderNumber,
        itemCount,
        total,
        flow: 'dine_in',
        trackHref: `/table/${tableId}/order`,
      });
      clearCart();
      onOrderPlaced?.();
    } catch (error) {
      Sentry.captureException(error);
      // The overlay path requires success. Failures fall back to the
      // legacy toast — most callers see this only when the post-create
      // `addOrderItems` request fails after the order row was created.
      toast.error(t('cart.orderError'));
    }
  };

  return {
    handlePlaceOrder,
    isPlacing,
    submittedByOtherTab: placeOrderKeys.submittedByOtherTab,
  };
}
