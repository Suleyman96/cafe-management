import type { MenuItem, Order } from '@gustri/database/types';
import { describe, expect, it } from 'vitest';
import { applyMenuFilter, deriveChannelFilter } from '../menu-channel-filter';

// What this file guards:
//   "Add items" pickers on both mobile (AddItemsScreen) and staff-web
//   (orders/[id]/add-items) filter the menu based on the *order_type* of
//   the order they're adding to. Takeout orders must exclude items the
//   admin flagged as non-takeoutable; delivery excludes non-deliverable.
//   Dine-in (and any unknown future order types) imposes no channel
//   filter.
//
//   These helpers live in @gustri/core so both platforms share one
//   implementation — the channel policy is one decision per order_type
//   and must not diverge across surfaces. Each screen is a thin caller:
//   `applyMenuFilter({ items, selectedCategoryId,
//   channelFilter: deriveChannelFilter(order.order_type) })`.

function makeItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 'mi-1',
    name: 'Burger',
    description: null,
    price: 10,
    category_id: 'cat-1',
    image_url: null,
    preparation_time: null,
    is_popular: false,
    is_vegetarian: false,
    is_vegan: false,
    is_gluten_free: false,
    is_spicy: false,
    allergens: null,
    is_available: true,
    is_takeoutable: true,
    is_deliverable: true,
    is_daily_special: false,
    display_order: 0,
    tenant_id: 't1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as unknown as MenuItem;
}

describe('deriveChannelFilter', () => {
  it('returns "takeoutable" for takeout orders', () => {
    expect(deriveChannelFilter('takeout')).toBe('takeoutable');
  });

  it('returns "deliverable" for delivery orders', () => {
    expect(deriveChannelFilter('delivery')).toBe('deliverable');
  });

  it('returns null for dine-in (no channel restriction)', () => {
    expect(deriveChannelFilter('dine_in')).toBeNull();
  });

  it('returns null for null/undefined (order not yet loaded)', () => {
    // The screen guards on `existingOrder` before calling this, but
    // belt-and-braces: a null pass-through must not throw.
    expect(deriveChannelFilter(null)).toBeNull();
    expect(deriveChannelFilter(undefined)).toBeNull();
  });

  it('returns null for unknown future order types (safe default)', () => {
    // Defensive: if a new order_type ships before the mobile app
    // updates, default-open is safer than default-closed — admins can
    // always tighten the channel via the per-item toggles. Hard-coding
    // a never-throws contract here.
    expect(deriveChannelFilter('drive_through' as unknown as Order['order_type'])).toBeNull();
  });
});

describe('applyMenuFilter', () => {
  const items = [
    makeItem({ id: 'a', category_id: 'cat-1', is_takeoutable: true, is_deliverable: true }),
    makeItem({ id: 'b', category_id: 'cat-1', is_takeoutable: false, is_deliverable: true }),
    makeItem({ id: 'c', category_id: 'cat-1', is_takeoutable: true, is_deliverable: false }),
    makeItem({ id: 'd', category_id: 'cat-2', is_takeoutable: true, is_deliverable: true }),
  ];

  it('returns all items when channelFilter is null and no category selected', () => {
    expect(
      applyMenuFilter({ items, selectedCategoryId: null, channelFilter: null }).map((i) => i.id),
    ).toEqual(['a', 'b', 'c', 'd']);
  });

  it('"takeoutable" filter excludes items where is_takeoutable=false', () => {
    expect(
      applyMenuFilter({ items, selectedCategoryId: null, channelFilter: 'takeoutable' }).map(
        (i) => i.id,
      ),
    ).toEqual(['a', 'c', 'd']);
  });

  it('"deliverable" filter excludes items where is_deliverable=false', () => {
    expect(
      applyMenuFilter({ items, selectedCategoryId: null, channelFilter: 'deliverable' }).map(
        (i) => i.id,
      ),
    ).toEqual(['a', 'b', 'd']);
  });

  it('category and channel filters combine (AND)', () => {
    // cat-1 narrows to a/b/c; takeoutable then removes b → a, c.
    expect(
      applyMenuFilter({
        items,
        selectedCategoryId: 'cat-1',
        channelFilter: 'takeoutable',
      }).map((i) => i.id),
    ).toEqual(['a', 'c']);
  });

  it('returns empty array when nothing matches', () => {
    // Hypothetical: a takeout order in a category where every item is
    // marked non-takeoutable. The picker should show "no items" rather
    // than render anything misleading.
    const noneTakeoutable = [
      makeItem({ id: 'x', category_id: 'cat-9', is_takeoutable: false }),
      makeItem({ id: 'y', category_id: 'cat-9', is_takeoutable: false }),
    ];
    expect(
      applyMenuFilter({
        items: noneTakeoutable,
        selectedCategoryId: 'cat-9',
        channelFilter: 'takeoutable',
      }),
    ).toEqual([]);
  });

  it('does not mutate the input array', () => {
    // Important for React render stability — if the filter mutated, a
    // subsequent useMemo dep check would see the same reference but
    // changed contents and skip the rerender.
    const input = [...items];
    const snapshot = items.map((i) => i.id);
    applyMenuFilter({ items: input, selectedCategoryId: 'cat-1', channelFilter: 'takeoutable' });
    expect(input.map((i) => i.id)).toEqual(snapshot);
  });

  it('returns a new array reference even when nothing is filtered', () => {
    // Defensive: `Array.prototype.filter` always returns a new array,
    // but assert it here so a future refactor that swaps to a
    // mutation-based impl trips the test.
    const result = applyMenuFilter({
      items,
      selectedCategoryId: null,
      channelFilter: null,
    });
    expect(result).not.toBe(items);
  });
});
