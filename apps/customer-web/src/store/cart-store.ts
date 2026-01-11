import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, MenuItem } from "@/types";

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

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (menuItem, quantity, notes) => {
        set((state) => {
          const existingItem = state.items.find(
            (item) => item.menuItem.id === menuItem.id
          );

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
                  : item
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
            item.menuItem.id === menuItemId ? { ...item, quantity } : item
          ),
        }));
      },

      updateNotes: (menuItemId, notes) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.menuItem.id === menuItemId ? { ...item, notes } : item
          ),
        }));
      },

      clearCart: () => {
        set({ items: [] });
      },

      getTotal: () => {
        const { items } = get();
        return items.reduce(
          (total, item) => total + item.menuItem.price * item.quantity,
          0
        );
      },

      getItemCount: () => {
        const { items } = get();
        return items.reduce((count, item) => count + item.quantity, 0);
      },
    }),
    {
      name: "cart-storage",
      // Partition by table to avoid cart conflicts
      partialize: (state) => ({ items: state.items }),
    }
  )
);


