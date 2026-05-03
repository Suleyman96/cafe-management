import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrderListCard } from '@/components/orders/order-list-card';
import type { OrderWithDetails } from '@/types';

function makeOrder(overrides: Partial<OrderWithDetails> = {}): OrderWithDetails {
  return {
    id: 'order-1',
    table_id: 'table-1',
    status: 'new',
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

describe('OrderListCard memoization', () => {
  it('skips re-render when props are referentially equal (memo cache hit)', () => {
    const formatPrice = vi.fn((amount: number) => `$${amount.toFixed(2)}`);
    const onStatusUpdate = vi.fn();
    const onOpenPayment = vi.fn();
    const onOpenCancel = vi.fn();
    const order = makeOrder();

    const { rerender } = render(
      <OrderListCard
        order={order}
        formatPrice={formatPrice}
        onStatusUpdate={onStatusUpdate}
        onOpenPayment={onOpenPayment}
        onOpenCancel={onOpenCancel}
      />,
    );
    const callsAfterMount = formatPrice.mock.calls.length;
    expect(callsAfterMount).toBeGreaterThan(0);

    // Same props (referentially) — memo should skip the entire render,
    // so formatPrice should not be invoked again.
    rerender(
      <OrderListCard
        order={order}
        formatPrice={formatPrice}
        onStatusUpdate={onStatusUpdate}
        onOpenPayment={onOpenPayment}
        onOpenCancel={onOpenCancel}
      />,
    );
    expect(formatPrice.mock.calls.length).toBe(callsAfterMount);
  });

  it('re-renders when order reference changes (e.g. row updated by realtime)', () => {
    const formatPrice = vi.fn((amount: number) => `$${amount.toFixed(2)}`);
    const onStatusUpdate = vi.fn();
    const onOpenPayment = vi.fn();
    const onOpenCancel = vi.fn();
    const order = makeOrder();

    const { rerender } = render(
      <OrderListCard
        order={order}
        formatPrice={formatPrice}
        onStatusUpdate={onStatusUpdate}
        onOpenPayment={onOpenPayment}
        onOpenCancel={onOpenCancel}
      />,
    );
    const callsAfterMount = formatPrice.mock.calls.length;

    const updated = makeOrder({ status: 'preparing' });
    rerender(
      <OrderListCard
        order={updated}
        formatPrice={formatPrice}
        onStatusUpdate={onStatusUpdate}
        onOpenPayment={onOpenPayment}
        onOpenCancel={onOpenCancel}
      />,
    );
    expect(formatPrice.mock.calls.length).toBeGreaterThan(callsAfterMount);
  });

  it('skips sibling cards when only one row in a list changes', () => {
    const formatPriceA = vi.fn((amount: number) => `A$${amount.toFixed(2)}`);
    const formatPriceB = vi.fn((amount: number) => `B$${amount.toFixed(2)}`);
    const noop = vi.fn();
    const orderA = makeOrder({ id: 'a' });
    const orderB = makeOrder({ id: 'b' });

    const Grid = ({ a, b }: { a: OrderWithDetails; b: OrderWithDetails }) => (
      <>
        <OrderListCard
          order={a}
          formatPrice={formatPriceA}
          onStatusUpdate={noop}
          onOpenPayment={noop}
          onOpenCancel={noop}
        />
        <OrderListCard
          order={b}
          formatPrice={formatPriceB}
          onStatusUpdate={noop}
          onOpenPayment={noop}
          onOpenCancel={noop}
        />
      </>
    );

    const { rerender } = render(<Grid a={orderA} b={orderB} />);
    const aCalls = formatPriceA.mock.calls.length;
    const bCalls = formatPriceB.mock.calls.length;

    // Update only A. B's reference is unchanged, so its memo should hit.
    const updatedA = makeOrder({ id: 'a', status: 'preparing' });
    rerender(<Grid a={updatedA} b={orderB} />);

    expect(formatPriceA.mock.calls.length).toBeGreaterThan(aCalls);
    expect(formatPriceB.mock.calls.length).toBe(bCalls);
  });
});
