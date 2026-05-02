import { useTranslation } from '@gustri/i18n';
import * as Sentry from '@sentry/nextjs';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useAddOrderItems, useCreateOrder, useOrder } from '@/hooks/use-order';
import { useTable } from '@/hooks/use-table';
import { useCartStore } from '@/store/cart-store';

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
  const router = useRouter();
  const { t } = useTranslation('customer');
  const { items, clearCart } = useCartStore();
  const formatPrice = useFormatPrice();

  const { data: table } = useTable(tableId);
  const actualTableId = table?.id || '';
  const { data: existingOrder } = useOrder(actualTableId);
  const createOrder = useCreateOrder();
  const addOrderItems = useAddOrderItems();

  const isPlacing = createOrder.isPending || addOrderItems.isPending;

  const handlePlaceOrder = async () => {
    if (items.length === 0 || !actualTableId) return;

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

      if (!orderId) {
        const newOrder = await createOrder.mutateAsync({
          tableId: actualTableId,
          notes: orderNotes,
        });
        orderId = newOrder.id;
        tenantId = newOrder.tenant_id;
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
        })),
      });

      toast.success(t('cart.orderSuccess'));
      clearCart();
      onOrderPlaced?.();
      router.push(`/table/${tableId}/order`);
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t('cart.orderError'));
    }
  };

  return { handlePlaceOrder, isPlacing };
}
