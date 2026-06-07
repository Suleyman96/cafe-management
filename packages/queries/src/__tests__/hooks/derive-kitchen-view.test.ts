/**
 * Pure-function tests for `deriveKitchenView` — the kitchen-screen filter
 * logic. Exercising the derivation directly (rather than mounting React)
 * keeps these fast and isolates the rules a stressed cook actually depends
 * on: which items show, which are reported as hidden, and how the active
 * filter is described back to the UI.
 */

import type { Category, OrderItemWithMenuItem, OrderWithDetails } from '@gustri/database/types';
import { describe, expect, it } from 'vitest';
import { deriveKitchenView } from '../../hooks/use-kitchen-view';

const PIZZA = 'cat-pizza';
const BAR = 'cat-bar';
const DESSERT = 'cat-dessert';

const categories: Category[] = [
  buildCategory({ id: PIZZA, name: 'Pizza' }),
  buildCategory({ id: BAR, name: 'Bar' }),
  buildCategory({ id: DESSERT, name: 'Dessert' }),
];

describe('deriveKitchenView', () => {
  describe('show-all mode (no filter set)', () => {
    it('returns every item on every order with hiddenCount=0', () => {
      const orders = [
        buildOrder('o1', [
          buildItem({ id: 'i1', categoryId: PIZZA }),
          buildItem({ id: 'i2', categoryId: BAR }),
        ]),
      ];
      const { visibleOrders, activeFilter } = deriveKitchenView({
        orders,
        filterCategoryIds: null,
        categories,
      });
      expect(activeFilter).toEqual({ mode: 'all' });
      expect(visibleOrders).toHaveLength(1);
      // length asserted above, so [0] is in-bounds
      expect(visibleOrders[0]!.visibleItems).toHaveLength(2);
      expect(visibleOrders[0]!.hiddenCount).toBe(0);
      expect(visibleOrders[0]!.hiddenByCategory).toEqual([]);
    });

    it('treats undefined filterCategoryIds as show-all', () => {
      const orders = [buildOrder('o1', [buildItem({ id: 'i1', categoryId: PIZZA })])];
      const { activeFilter } = deriveKitchenView({
        orders,
        filterCategoryIds: undefined,
        categories,
      });
      expect(activeFilter).toEqual({ mode: 'all' });
    });

    it('treats an empty filter array as show-all (the no-rows semantic)', () => {
      const orders = [buildOrder('o1', [buildItem({ id: 'i1', categoryId: PIZZA })])];
      const { activeFilter } = deriveKitchenView({
        orders,
        filterCategoryIds: [],
        categories,
      });
      expect(activeFilter).toEqual({ mode: 'all' });
    });

    it('shows uncategorized items in show-all mode', () => {
      const orders = [
        buildOrder('o1', [
          buildItem({ id: 'i1', categoryId: PIZZA }),
          buildItem({ id: 'i2', categoryId: null }),
        ]),
      ];
      const { visibleOrders } = deriveKitchenView({
        orders,
        filterCategoryIds: null,
        categories,
      });
      // single order pushed above, so [0] is in-bounds
      expect(visibleOrders[0]!.visibleItems.map((i) => i.id)).toEqual(['i1', 'i2']);
    });
  });

  describe('filtered mode', () => {
    it('shows only items whose category is in the filter set', () => {
      const orders = [
        buildOrder('o1', [
          buildItem({ id: 'i1', categoryId: PIZZA }),
          buildItem({ id: 'i2', categoryId: BAR }),
          buildItem({ id: 'i3', categoryId: DESSERT }),
        ]),
      ];
      const { visibleOrders, activeFilter } = deriveKitchenView({
        orders,
        filterCategoryIds: [PIZZA],
        categories,
      });
      expect(activeFilter).toEqual({
        mode: 'filtered',
        categoryIds: [PIZZA],
        names: ['Pizza'],
      });
      expect(visibleOrders).toHaveLength(1);
      // length asserted above, so [0] is in-bounds
      expect(visibleOrders[0]!.visibleItems.map((i) => i.id)).toEqual(['i1']);
      expect(visibleOrders[0]!.hiddenCount).toBe(2);
    });

    it('groups hidden items by their category for the coordination summary', () => {
      const orders = [
        buildOrder('o1', [
          buildItem({ id: 'i1', categoryId: PIZZA }),
          buildItem({ id: 'i2', categoryId: BAR }),
          buildItem({ id: 'i3', categoryId: BAR }),
          buildItem({ id: 'i4', categoryId: DESSERT }),
        ]),
      ];
      const { visibleOrders } = deriveKitchenView({
        orders,
        filterCategoryIds: [PIZZA],
        categories,
      });
      // single order pushed above, so [0] is in-bounds
      const buckets = visibleOrders[0]!.hiddenByCategory;
      expect(buckets).toHaveLength(2);
      const bar = buckets.find((b) => b.categoryId === BAR);
      const dessert = buckets.find((b) => b.categoryId === DESSERT);
      expect(bar).toEqual({ categoryId: BAR, categoryName: 'Bar', count: 2 });
      expect(dessert).toEqual({ categoryId: DESSERT, categoryName: 'Dessert', count: 1 });
    });

    it('drops orders that have zero matching items entirely', () => {
      const orders = [
        buildOrder('o1', [buildItem({ id: 'i1', categoryId: BAR })]),
        buildOrder('o2', [buildItem({ id: 'i2', categoryId: PIZZA })]),
      ];
      const { visibleOrders } = deriveKitchenView({
        orders,
        filterCategoryIds: [PIZZA],
        categories,
      });
      expect(visibleOrders.map((o) => o.id)).toEqual(['o2']);
    });

    it('hides uncategorized items (null category_id) in filtered mode', () => {
      const orders = [
        buildOrder('o1', [
          buildItem({ id: 'i1', categoryId: PIZZA }),
          buildItem({ id: 'i2', categoryId: null }),
        ]),
      ];
      const { visibleOrders } = deriveKitchenView({
        orders,
        filterCategoryIds: [PIZZA],
        categories,
      });
      // single order pushed above, so [0] is in-bounds
      expect(visibleOrders[0]!.visibleItems.map((i) => i.id)).toEqual(['i1']);
      expect(visibleOrders[0]!.hiddenCount).toBe(1);
      const uncategorizedBucket = visibleOrders[0]!.hiddenByCategory.find(
        (b) => b.categoryId === null,
      );
      expect(uncategorizedBucket).toEqual({ categoryId: null, categoryName: null, count: 1 });
    });

    it('falls back to the category id as label when the category cache is stale', () => {
      const orders = [buildOrder('o1', [buildItem({ id: 'i1', categoryId: 'cat-deleted' })])];
      const { activeFilter } = deriveKitchenView({
        orders,
        filterCategoryIds: ['cat-deleted'],
        categories,
      });
      expect(activeFilter).toEqual({
        mode: 'filtered',
        categoryIds: ['cat-deleted'],
        names: ['cat-deleted'],
      });
    });

    it('handles multiple selected categories', () => {
      const orders = [
        buildOrder('o1', [
          buildItem({ id: 'i1', categoryId: PIZZA }),
          buildItem({ id: 'i2', categoryId: BAR }),
          buildItem({ id: 'i3', categoryId: DESSERT }),
        ]),
      ];
      const { visibleOrders, activeFilter } = deriveKitchenView({
        orders,
        filterCategoryIds: [PIZZA, BAR],
        categories,
      });
      expect(activeFilter.mode).toBe('filtered');
      // single order pushed above, so [0] is in-bounds
      expect(visibleOrders[0]!.visibleItems.map((i) => i.id).sort()).toEqual(['i1', 'i2']);
      expect(visibleOrders[0]!.hiddenCount).toBe(1);
    });
  });
});

// ─── Builders ────────────────────────────────────────────────────

function buildCategory(overrides: { id: string; name: string }): Category {
  return {
    id: overrides.id,
    tenant_id: 'test-tenant',
    name: overrides.name,
    description: null,
    icon: null,
    display_order: 0,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };
}

function buildItem(overrides: { id: string; categoryId: string | null }): OrderItemWithMenuItem {
  return {
    id: overrides.id,
    tenant_id: 'test-tenant',
    order_id: 'o-any',
    menu_item_id: 'mi-any',
    category_id: overrides.categoryId,
    item_name: 'Test Item',
    item_price: 10,
    quantity: 1,
    notes: null,
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as OrderItemWithMenuItem;
}

function buildOrder(id: string, items: OrderItemWithMenuItem[]): OrderWithDetails {
  return {
    id,
    tenant_id: 'test-tenant',
    table_id: null,
    assigned_waiter_id: null,
    order_number: `ORD-${id}`,
    status: 'new',
    source: 'waiter',
    order_type: 'dine_in',
    customer_name: null,
    customer_phone: null,
    subtotal: 0,
    tax: 0,
    total: 0,
    customer_notes: null,
    internal_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    preparing_at: null,
    ready_at: null,
    served_at: null,
    closed_at: null,
    payment_method: null,
    paid_at: null,
    discount_type: 'none',
    discount_value: 0,
    discount_amount: 0,
    discount_reason: null,
    discount_applied_by: null,
    delivery_address: null,
    delivery_fee: 0,
    delivery_notes: null,
    estimated_delivery_time: null,
    delivered_at: null,
    delivery_person_id: null,
    delivery_access_token: null,
    table: { table_number: '1', location: null },
    order_items: items,
    assigned_waiter: null,
  } as unknown as OrderWithDetails;
}
