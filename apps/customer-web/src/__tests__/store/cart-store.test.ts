import { useCartStore } from '@/store/cart-store';
import type { MenuItem } from '@/types';

const mockMenuItem = (overrides: Partial<MenuItem> = {}): MenuItem =>
  ({
    id: 'm1',
    name_en: 'Coffee',
    price: 5,
    ...overrides,
  }) as MenuItem;

beforeEach(() => {
  localStorage.clear();
  useCartStore.setState({ items: [] });
});

describe('useCartStore', () => {
  describe('addItem', () => {
    it('adds a new item to empty cart', () => {
      useCartStore.getState().addItem(mockMenuItem(), 2, 'Extra sugar');

      const { items } = useCartStore.getState();
      expect(items).toHaveLength(1);
      expect(items[0].menuItem.id).toBe('m1');
      expect(items[0].quantity).toBe(2);
      expect(items[0].notes).toBe('Extra sugar');
    });

    it('increments quantity for existing item', () => {
      useCartStore.getState().addItem(mockMenuItem(), 1);
      useCartStore.getState().addItem(mockMenuItem(), 3);

      const { items } = useCartStore.getState();
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(4);
    });

    it('updates notes only when new notes provided', () => {
      useCartStore.getState().addItem(mockMenuItem(), 1, 'Original note');
      useCartStore.getState().addItem(mockMenuItem(), 1); // no notes

      const { items } = useCartStore.getState();
      expect(items[0].notes).toBe('Original note');
    });

    it('overwrites notes when new notes provided', () => {
      useCartStore.getState().addItem(mockMenuItem(), 1, 'Original note');
      useCartStore.getState().addItem(mockMenuItem(), 1, 'New note');

      const { items } = useCartStore.getState();
      expect(items[0].notes).toBe('New note');
    });

    it('adds different items separately', () => {
      useCartStore.getState().addItem(mockMenuItem({ id: 'm1' }), 1);
      useCartStore.getState().addItem(mockMenuItem({ id: 'm2', name: 'Tea', price: 3 }), 2);

      const { items } = useCartStore.getState();
      expect(items).toHaveLength(2);
    });
  });

  describe('removeItem', () => {
    it('removes item by menuItemId', () => {
      useCartStore.getState().addItem(mockMenuItem({ id: 'm1' }), 1);
      useCartStore.getState().addItem(mockMenuItem({ id: 'm2' }), 1);

      useCartStore.getState().removeItem('m1');

      const { items } = useCartStore.getState();
      expect(items).toHaveLength(1);
      expect(items[0].menuItem.id).toBe('m2');
    });

    it('does nothing when item not found', () => {
      useCartStore.getState().addItem(mockMenuItem(), 1);
      useCartStore.getState().removeItem('nonexistent');

      expect(useCartStore.getState().items).toHaveLength(1);
    });
  });

  describe('updateQuantity', () => {
    it('updates quantity for existing item', () => {
      useCartStore.getState().addItem(mockMenuItem(), 1);
      useCartStore.getState().updateQuantity('m1', 5);

      expect(useCartStore.getState().items[0].quantity).toBe(5);
    });

    it('removes item when quantity is 0', () => {
      useCartStore.getState().addItem(mockMenuItem(), 1);
      useCartStore.getState().updateQuantity('m1', 0);

      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('removes item when quantity is negative', () => {
      useCartStore.getState().addItem(mockMenuItem(), 1);
      useCartStore.getState().updateQuantity('m1', -1);

      expect(useCartStore.getState().items).toHaveLength(0);
    });
  });

  describe('updateNotes', () => {
    it('updates notes for item', () => {
      useCartStore.getState().addItem(mockMenuItem(), 1, 'Old note');
      useCartStore.getState().updateNotes('m1', 'New note');

      expect(useCartStore.getState().items[0].notes).toBe('New note');
    });
  });

  describe('clearCart', () => {
    it('removes all items', () => {
      useCartStore.getState().addItem(mockMenuItem({ id: 'm1' }), 1);
      useCartStore.getState().addItem(mockMenuItem({ id: 'm2' }), 2);

      useCartStore.getState().clearCart();

      expect(useCartStore.getState().items).toHaveLength(0);
    });
  });

  describe('getTotal', () => {
    it('returns 0 for empty cart', () => {
      expect(useCartStore.getState().getTotal()).toBe(0);
    });

    it('calculates total correctly', () => {
      useCartStore.getState().addItem(mockMenuItem({ id: 'm1', price: 5.5 }), 2);
      useCartStore.getState().addItem(mockMenuItem({ id: 'm2', price: 3 }), 3);

      // 5.5 * 2 + 3 * 3 = 11 + 9 = 20
      expect(useCartStore.getState().getTotal()).toBe(20);
    });
  });

  describe('getItemCount', () => {
    it('returns 0 for empty cart', () => {
      expect(useCartStore.getState().getItemCount()).toBe(0);
    });

    it('sums all quantities (not unique items)', () => {
      useCartStore.getState().addItem(mockMenuItem({ id: 'm1' }), 2);
      useCartStore.getState().addItem(mockMenuItem({ id: 'm2' }), 3);

      // 2 + 3 = 5 total items
      expect(useCartStore.getState().getItemCount()).toBe(5);
    });
  });
});
