import { useCartStore } from '@/store/cart-store';
import type { MenuItem } from '@/types';

const mockMenuItem = (overrides: Partial<MenuItem> = {}): MenuItem =>
  ({ id: 'm1', name_en: 'Coffee', price: 5, ...overrides }) as MenuItem;

beforeEach(() => {
  localStorage.clear();
  useCartStore.setState({ items: [], partition: null, lastTouchedAt: 0 });
});

describe('cart partitioning (M4)', () => {
  it('swapping tenant via setPartition resets items', () => {
    // Tenant A cart with 2 items.
    useCartStore.getState().setPartition({ flow: 'dine_in', tenantId: 'A', tableId: 't1' });
    useCartStore.getState().addItem(mockMenuItem(), 2);
    expect(useCartStore.getState().items).toHaveLength(1);

    // Swap to tenant B → fresh empty cart (no carry-over). This is the
    // exact failure scenario #4 the partition closes: the customer can't
    // submit tenant A's `menu_item_id` against tenant B's qr_token.
    useCartStore.getState().setPartition({ flow: 'delivery', tenantId: 'B' });
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('swapping back to a tenant restores its persisted items', () => {
    useCartStore.getState().setPartition({ flow: 'dine_in', tenantId: 'A', tableId: 't1' });
    useCartStore.getState().addItem(mockMenuItem(), 3);

    useCartStore.getState().setPartition({ flow: 'delivery', tenantId: 'B' });
    expect(useCartStore.getState().items).toHaveLength(0);

    useCartStore.getState().setPartition({ flow: 'dine_in', tenantId: 'A', tableId: 't1' });
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].quantity).toBe(3);
  });

  it('drops stored partition when lastTouchedAt is older than TTL', () => {
    // Manually write an old payload — direct localStorage poke is the
    // fastest way to simulate "scanned three days ago".
    const FIVE_HOURS = 5 * 60 * 60 * 1000;
    const payload = {
      items: [{ menuItem: mockMenuItem(), quantity: 1 }],
      lastTouchedAt: Date.now() - FIVE_HOURS,
    };
    localStorage.setItem('cart:dine_in:A:t1', JSON.stringify(payload));

    useCartStore.getState().setPartition({ flow: 'dine_in', tenantId: 'A', tableId: 't1' });

    expect(useCartStore.getState().items).toHaveLength(0);
    // Stale entry is purged on load to keep the bucket clean.
    expect(localStorage.getItem('cart:dine_in:A:t1')).toBeNull();
  });

  it('clearCart removes the stored partition row', () => {
    useCartStore.getState().setPartition({ flow: 'dine_in', tenantId: 'A', tableId: 't1' });
    useCartStore.getState().addItem(mockMenuItem(), 1);
    expect(localStorage.getItem('cart:dine_in:A:t1')).not.toBeNull();

    useCartStore.getState().clearCart();
    expect(localStorage.getItem('cart:dine_in:A:t1')).toBeNull();
  });

  it('storage key encodes flow + tenant + tableId (or `_` for delivery)', () => {
    useCartStore.getState().setPartition({ flow: 'dine_in', tenantId: 'A', tableId: 't1' });
    useCartStore.getState().addItem(mockMenuItem(), 1);
    expect(localStorage.getItem('cart:dine_in:A:t1')).not.toBeNull();

    useCartStore.getState().setPartition({ flow: 'delivery', tenantId: 'A' });
    useCartStore.getState().addItem(mockMenuItem(), 1);
    expect(localStorage.getItem('cart:delivery:A:_')).not.toBeNull();
  });
});
