'use client';

import type { Database } from '@gustri/database';
import { useCallback, useState } from 'react';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];

type CartItem = {
  menuItem: MenuItem;
  quantity: number;
};

export function useStaffCart() {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = useCallback((menuItem: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.menuItem.id === menuItem.id);
      if (existing) {
        return prev.map((item) =>
          item.menuItem.id === menuItem.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...prev, { menuItem, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((menuItemId: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.menuItem.id === menuItemId);
      if (existing && existing.quantity > 1) {
        return prev.map((item) =>
          item.menuItem.id === menuItemId ? { ...item, quantity: item.quantity - 1 } : item,
        );
      }
      return prev.filter((item) => item.menuItem.id !== menuItemId);
    });
  }, []);

  const getCartQuantity = useCallback(
    (menuItemId: string) => {
      return cart.find((item) => item.menuItem.id === menuItemId)?.quantity || 0;
    },
    [cart],
  );

  const clearCart = useCallback(() => setCart([]), []);

  return { cart, setCart, addToCart, removeFromCart, getCartQuantity, clearCart };
}
