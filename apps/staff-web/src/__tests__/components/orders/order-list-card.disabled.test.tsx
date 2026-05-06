import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('OrderListCard — per-button pending lock', () => {
  it('rapid triple-click on the active status button fires onStatusUpdate exactly once until settle', async () => {
    const user = userEvent.setup();
    // Slow callback so the first click is still in flight when 2 + 3 fire.
    let resolveFn: (() => void) | undefined;
    const onStatusUpdate = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFn = resolve;
        }),
    );

    render(
      <OrderListCard
        order={makeOrder()}
        formatPrice={(n: number) => `$${n.toFixed(2)}`}
        onStatusUpdate={onStatusUpdate}
        onOpenPayment={vi.fn()}
        onOpenCancel={vi.fn()}
      />,
    );

    // For status="preparing" the active advance button is "Ready".
    const readyBtn = screen.getByRole('button', { name: /ready/i });

    await user.click(readyBtn);
    await user.click(readyBtn);
    await user.click(readyBtn);

    // The ref-based gate inside `usePendingAction` swallows the second and
    // third clicks even before React commits the disabled state.
    expect(onStatusUpdate).toHaveBeenCalledTimes(1);

    // Settle the in-flight mutation; the button becomes clickable again.
    resolveFn?.();
  });

  it('does NOT lock unrelated buttons in the same row (per-button granularity)', async () => {
    const user = userEvent.setup();
    let resolveStatus: (() => void) | undefined;
    const onStatusUpdate = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveStatus = resolve;
        }),
    );
    const onOpenCancel = vi.fn();

    render(
      <OrderListCard
        order={makeOrder()}
        formatPrice={(n: number) => `$${n.toFixed(2)}`}
        onStatusUpdate={onStatusUpdate}
        onOpenPayment={vi.fn()}
        onOpenCancel={onOpenCancel}
      />,
    );

    const readyBtn = screen.getByRole('button', { name: /ready/i });
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });

    // Status mutation in flight — Ready is locked, Cancel is not.
    await user.click(readyBtn);
    expect(readyBtn).toBeDisabled();
    expect(cancelBtn).not.toBeDisabled();

    await user.click(cancelBtn);
    expect(onOpenCancel).toHaveBeenCalledTimes(1);

    resolveStatus?.();
  });
});
