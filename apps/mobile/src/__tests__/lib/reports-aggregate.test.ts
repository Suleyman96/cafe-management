import { describe, expect, it } from 'vitest';
import { aggregateReports } from '@/lib/reports-aggregate';
import type { OrderWithDetails } from '@/types';

const UNKNOWN = 'Unknown';

function order(partial: Partial<OrderWithDetails> = {}): OrderWithDetails {
  return {
    id: partial.id ?? `order-${Math.random()}`,
    status: partial.status ?? 'closed',
    total: partial.total ?? 10,
    order_type: partial.order_type ?? 'dine_in',
    assigned_waiter_id: partial.assigned_waiter_id ?? null,
    order_items: partial.order_items ?? [],
  } as unknown as OrderWithDetails;
}

describe('aggregateReports', () => {
  it('returns zeros for an empty list', () => {
    const out = aggregateReports([], [], UNKNOWN);
    expect(out.totals).toEqual({ revenue: 0, orderCount: 0, avgOrderValue: 0, completionRate: 0 });
    expect(out.byType).toEqual({ dine_in: 0, takeout: 0, delivery: 0 });
    expect(out.topItems).toEqual([]);
    expect(out.byStaff).toEqual([]);
  });

  it('computes totals from paid orders only', () => {
    const orders = [
      order({ status: 'closed', total: 30 }),
      order({ status: 'served', total: 20 }),
      // 'preparing' is non-paid, but still counts toward orderCount.
      order({ status: 'preparing', total: 999 }),
    ];
    const { totals } = aggregateReports(orders, [], UNKNOWN);
    expect(totals.revenue).toBe(50);
    expect(totals.orderCount).toBe(3);
    expect(totals.avgOrderValue).toBeCloseTo(25);
    expect(totals.completionRate).toBeCloseTo((2 / 3) * 100);
  });

  it('counts order types', () => {
    const out = aggregateReports(
      [
        order({ order_type: 'dine_in' }),
        order({ order_type: 'takeout' }),
        order({ order_type: 'takeout' }),
        order({ order_type: 'delivery' }),
      ],
      [],
      UNKNOWN,
    );
    expect(out.byType).toEqual({ dine_in: 1, takeout: 2, delivery: 1 });
  });

  it('aggregates top items across orders, sorted desc by qty', () => {
    const orders = [
      order({
        order_items: [
          { menu_item: { name: 'Pizza' }, quantity: 2, item_price: 5 },
          { menu_item: { name: 'Coke' }, quantity: 1, item_price: 2 },
        ],
      }),
      order({
        order_items: [{ menu_item: { name: 'Pizza' }, quantity: 3, item_price: 5 }],
      }),
    ] as unknown as OrderWithDetails[];

    const { topItems } = aggregateReports(orders, [], UNKNOWN);
    expect(topItems[0]).toEqual({ name: 'Pizza', qty: 5, revenue: 25 });
    expect(topItems[1]).toEqual({ name: 'Coke', qty: 1, revenue: 2 });
  });

  it('builds staff performance via map (no nested .find)', () => {
    const staff = [
      { id: 'w1', full_name: 'Alice' },
      { id: 'w2', full_name: 'Bob' },
    ];
    const orders = [
      order({ assigned_waiter_id: 'w1', total: 10, status: 'closed' }),
      order({ assigned_waiter_id: 'w1', total: 25, status: 'closed' }),
      order({ assigned_waiter_id: 'w2', total: 5, status: 'served' }),
      order({ assigned_waiter_id: null, total: 100 }),
    ];
    const { byStaff } = aggregateReports(orders, staff, UNKNOWN);
    expect(byStaff).toEqual([
      { name: 'Alice', orders: 2, revenue: 35 },
      { name: 'Bob', orders: 1, revenue: 5 },
    ]);
  });

  it('falls back to unknownLabel for missing menu name and missing staff', () => {
    const orders = [
      order({
        assigned_waiter_id: 'ghost',
        total: 7,
        order_items: [{ menu_item: null, quantity: 1, item_price: 7 }],
      }),
    ] as unknown as OrderWithDetails[];
    const out = aggregateReports(orders, [], UNKNOWN);
    expect(out.topItems[0].name).toBe(UNKNOWN);
    expect(out.byStaff[0].name).toBe(UNKNOWN);
  });
});
