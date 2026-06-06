'use client';

import { ActiveOrderBanner } from '@/components/order/active-order-banner';
import { useOrder } from '@/hooks/use-order';
import { useOrderEta } from '@/hooks/use-order-eta';
import { useTable } from '@/hooks/use-table';

// M5 — dine-in only. Extracted so we don't fire `useTable` / `useOrder`
// in the delivery flow (the table sentinel `__delivery__` would 404 and
// pollute Sentry). The parent mounts this conditionally based on
// `isDelivery`.
export function MenuActiveOrderBanner({ tableId }: { tableId: string }) {
  const { data: table } = useTable(tableId);
  const actualTableId = table?.id || '';
  const { data: existingOrder } = useOrder(actualTableId);
  const eta = useOrderEta(
    existingOrder?.order_items,
    existingOrder?.status,
    existingOrder?.created_at,
    existingOrder?.id,
  );
  if (!existingOrder?.order_number) return null;
  return (
    <ActiveOrderBanner
      orderNumber={existingOrder.order_number}
      href={`/table/${tableId}/order`}
      eta={eta}
    />
  );
}
