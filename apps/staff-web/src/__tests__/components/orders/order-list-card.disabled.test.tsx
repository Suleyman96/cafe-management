import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OrderListCard } from '@/components/orders/order-list-card';
import type { OrderWithDetails } from '@/types';

function makeOrder(overrides: Partial<OrderWithDetails> = {}): OrderWithDetails {
  return {
    id: 'order-1',
    table_id: 'table-1',
    status: 'preparing',
    order_type: 'dine_in',
    source: 'waiter',
    created_at: '2026-05-03T10:00:00Z',
    updated_at: '2026-05-03T10:00:00Z',
    customer_name: null,
    customer_phone: null,
    delivery_address: null,
    delivery_fee: null,
    delivery_person_id: null,
    assigned_waiter: null,
    delivery_person: null,
    table: { table_number: '1', location: null },
    order_items: [
      {
        id: 'item-1',
        order_id: 'order-1',
        menu_item_id: 'mi-1',
        item_name: 'Coffee',
        quantity: 1,
        item_price: 5,
        status: 'pending',
        notes: null,
        created_at: '2026-05-03T10:00:00Z',
        updated_at: '2026-05-03T10:00:00Z',
        menu_item: { id: 'mi-1', name: 'Coffee' } as never,
      } as never,
    ],
    total: 5,
    ...overrides,
  } as OrderWithDetails;
}

describe('OrderListCard — pending mutation disables status buttons', () => {
  it('disables the active status button when isStatusUpdatePending matches the row id', () => {
    const formatPrice = (n: number) => `$${n.toFixed(2)}`;
    const onStatusUpdate = vi.fn();

    render(
      <OrderListCard
        order={makeOrder()}
        formatPrice={formatPrice}
        onStatusUpdate={onStatusUpdate}
        onOpenPayment={vi.fn()}
        onOpenCancel={vi.fn()}
        isStatusUpdatePending={true}
        pendingOrderId={'order-1'}
      />,
    );

    // For status="preparing" the active advance button is "Ready".
    const readyBtn = screen.getByRole('button', { name: /ready/i });
    expect(readyBtn).toBeDisabled();
  });

  it('does NOT disable the button when pendingOrderId points to a different row', () => {
    render(
      <OrderListCard
        order={makeOrder()}
        formatPrice={(n) => `$${n.toFixed(2)}`}
        onStatusUpdate={vi.fn()}
        onOpenPayment={vi.fn()}
        onOpenCancel={vi.fn()}
        isStatusUpdatePending={true}
        pendingOrderId={'some-other-order'}
      />,
    );

    expect(screen.getByRole('button', { name: /ready/i })).not.toBeDisabled();
  });

  it('rapid triple-click while pending fires onStatusUpdate exactly once', async () => {
    const user = userEvent.setup();
    const onStatusUpdate = vi.fn();

    // Parent re-renders with pendingOrderId set after the first click.
    // We simulate that by rendering a wrapper component that flips
    // isStatusUpdatePending to true after the first invocation.
    const Harness = () => {
      const [pending, setPending] = useState(false);
      return (
        <OrderListCard
          order={makeOrder()}
          formatPrice={(n: number) => `$${n.toFixed(2)}`}
          onStatusUpdate={(id, s) => {
            onStatusUpdate(id, s);
            setPending(true);
          }}
          onOpenPayment={vi.fn()}
          onOpenCancel={vi.fn()}
          isStatusUpdatePending={pending}
          pendingOrderId={pending ? 'order-1' : null}
        />
      );
    };

    render(<Harness />);
    const btn = screen.getByRole('button', { name: /ready/i });

    await user.click(btn);
    await user.click(btn);
    await user.click(btn);

    // After the first click the button is disabled, so subsequent clicks
    // are swallowed by the DOM and do not invoke the callback again.
    expect(onStatusUpdate).toHaveBeenCalledTimes(1);
  });
});
