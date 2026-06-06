import { useCallback, useMemo, useState } from 'react';

/**
 * A single line in an order cart. Normalized shape shared by both the
 * delivery create-order modal and the add-items screen: each stores at most
 * id / name / price / quantity, so a single representation serves both.
 */
export interface CartLine {
  /** menu_item.id — the cart key */
  id: string;
  /** display name; falls back to a caller-provided default when null/undefined */
  name: string;
  /** unit price */
  price: number;
  /** quantity in cart (always >= 1 while the line exists) */
  quantity: number;
}

/** Minimum shape `addItem` needs from a menu item. Both call sites satisfy it. */
export interface AddableItem {
  id: string;
  price: number;
  name?: string | null;
}

export interface UseOrderCartOptions {
  /**
   * Fallback used when an added item has a null/undefined name.
   * AddItemsScreen historically defaulted to `'Item'`; delivery always
   * passes a real name. Defaults to `'Item'` to preserve that behavior.
   */
  fallbackName?: string;
}

export interface UseOrderCart {
  /** Cart keyed by item id. Insertion order preserved (Map semantics). */
  cart: Map<string, CartLine>;
  /** Cart lines in insertion order. Stable reference until the cart changes. */
  cartItems: CartLine[];
  /** true when the cart has at least one line. */
  hasItems: boolean;
  /** Sum of price * quantity across all lines. */
  subtotal: number;
  /** Sum of quantities across all lines. */
  count: number;
  /** Current quantity for an item id (0 when absent). */
  getQuantity: (id: string) => number;
  /** Add one unit of an item (creates the line at qty 1 if absent). */
  addItem: (item: AddableItem) => void;
  /**
   * Adjust an existing line's quantity by `delta`. Removes the line when the
   * resulting quantity is <= 0. No-op when the line doesn't exist.
   */
  updateQty: (id: string, delta: number) => void;
  /**
   * Decrement one unit of an item; removes the line when quantity reaches 0.
   * Equivalent to `updateQty(id, -1)`.
   */
  removeItem: (id: string) => void;
  /** Empty the cart. */
  clear: () => void;
}

/**
 * Shared order-cart state for mobile order-creation flows.
 *
 * Behavior is identical to the two hand-rolled implementations it replaces:
 * - `addItem` increments by 1, creating the line at qty 1 if absent.
 * - `updateQty(id, delta)` adjusts and removes the line at qty <= 0.
 * - `removeItem(id)` decrements by 1 and removes the line at qty 0
 *   (matches AddItemsScreen's old remove-at-<=1 semantics — qty 1 minus 1
 *   deletes; qty 2 minus 1 leaves 1).
 *
 * Tax / delivery-fee math is intentionally NOT in here — each screen folds
 * those in differently (delivery applies proportional tax + a fee; add-items
 * shows a bare item total). The hook only owns subtotal/count so neither
 * screen's totals behavior changes.
 */
export function useOrderCart(options: UseOrderCartOptions = {}): UseOrderCart {
  const { fallbackName = 'Item' } = options;
  const [cart, setCart] = useState<Map<string, CartLine>>(() => new Map());

  const cartItems = useMemo(() => Array.from(cart.values()), [cart]);
  const hasItems = cartItems.length > 0;

  const subtotal = useMemo(
    () => cartItems.reduce((sum, line) => sum + line.price * line.quantity, 0),
    [cartItems],
  );
  const count = useMemo(() => cartItems.reduce((sum, line) => sum + line.quantity, 0), [cartItems]);

  const getQuantity = useCallback((id: string) => cart.get(id)?.quantity ?? 0, [cart]);

  const addItem = useCallback(
    (item: AddableItem) => {
      setCart((prev) => {
        const next = new Map(prev);
        const existing = next.get(item.id);
        next.set(item.id, {
          id: item.id,
          name: item.name ?? fallbackName,
          price: item.price,
          quantity: existing ? existing.quantity + 1 : 1,
        });
        return next;
      });
    },
    [fallbackName],
  );

  const updateQty = useCallback((id: string, delta: number) => {
    setCart((prev) => {
      const existing = prev.get(id);
      if (!existing) return prev;
      const next = new Map(prev);
      const newQty = existing.quantity + delta;
      if (newQty <= 0) {
        next.delete(id);
      } else {
        next.set(id, { ...existing, quantity: newQty });
      }
      return next;
    });
  }, []);

  const removeItem = useCallback((id: string) => updateQty(id, -1), [updateQty]);

  const clear = useCallback(() => setCart(new Map()), []);

  return {
    cart,
    cartItems,
    hasItems,
    subtotal,
    count,
    getQuantity,
    addItem,
    updateQty,
    removeItem,
    clear,
  };
}
