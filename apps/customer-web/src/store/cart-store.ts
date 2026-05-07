import { create } from 'zustand';
import type { CartItem, MenuItem } from '@/types';

/**
 * In-memory cart for the customer-web QR-ordering session.
 *
 * Why no persistence. The pre-PR version persisted to `localStorage` under
 * a single global key (`cart-storage`) and a comment claimed it was
 * "partition[ed] by table" — it wasn't. A customer who scanned table A,
 * added items, then walked to table B and scanned the new QR opened the
 * same browser context with table A's cart still in state. The audit
 * (post-#107 fresh pass) flagged this as the cleanest fix path: drop
 * persistence entirely.
 *
 * QR ordering is a session-bound flow — the customer scans, browses,
 * checks out, leaves. Reload mid-session is rare, and the cost of losing
 * a few items to a refresh is much smaller than the cost of placing an
 * order with the wrong table's items. The cross-tab `storage`-event
 * listener went with persistence; two tabs of the customer flow now
 * keep independent carts (which matches the contract — each tab is its
 * own session).
 *
 * If reload-survives-cart ever becomes a real ask, the right shape is a
 * per-tableId / per-qrToken partition (custom storage adapter that keys
 * on the route param), NOT a global `localStorage` key.
 */

interface CartStore {
  items: CartItem[];
  addItem: (menuItem: MenuItem, quantity: number, notes?: string) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  updateNotes: (menuItemId: string, notes: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartStore>()((set, get) => ({
  items: [],

  addItem: (menuItem, quantity, notes) => {
    set((state) => {
      const existingItem = state.items.find((item) => item.menuItem.id === menuItem.id);

      if (existingItem) {
        // Update existing item
        return {
          items: state.items.map((item) =>
            item.menuItem.id === menuItem.id
              ? {
                  ...item,
                  quantity: item.quantity + quantity,
                  notes: notes || item.notes,
                }
              : item,
          ),
        };
      }

      // Add new item
      return {
        items: [...state.items, { menuItem, quantity, notes }],
      };
    });
  },

  removeItem: (menuItemId) => {
    set((state) => ({
      items: state.items.filter((item) => item.menuItem.id !== menuItemId),
    }));
  },

  updateQuantity: (menuItemId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(menuItemId);
      return;
    }

    set((state) => ({
      items: state.items.map((item) =>
        item.menuItem.id === menuItemId ? { ...item, quantity } : item,
      ),
    }));
  },

  updateNotes: (menuItemId, notes) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.menuItem.id === menuItemId ? { ...item, notes } : item,
      ),
    }));
  },

  clearCart: () => {
    set({ items: [] });
  },

  getTotal: () => {
    const { items } = get();
    return items.reduce((total, item) => total + item.menuItem.price * item.quantity, 0);
  },

  getItemCount: () => {
    const { items } = get();
    return items.reduce((count, item) => count + item.quantity, 0);
  },
}));
