import { useMemo, useState } from 'react';
import type { OrderItemWithMenuItem } from '@/types';

interface UseItemPaymentSubtotalArgs {
  /** Items eligible for items-mode payment (unpaid, non-cancelled). */
  unpaidItems: OrderItemWithMenuItem[];
  /** Order pre-tax subtotal — denominator for the proportional tax split. */
  orderSubtotal: number;
  /** Order tax — numerator basis for the proportional tax split. */
  orderTax: number;
}

export interface UseItemPaymentSubtotalResult {
  /** Per-item selected qty (0 = unselected). Parity with web's `selectedItemQuantities`. */
  selectedItemQuantities: Map<string, number>;
  /** Selected items subtotal (pre-tax). */
  selectedSubtotal: number;
  /** Proportional tax share for the selected slice. Mirrors web's calc. */
  selectedTax: number;
  /** Selected subtotal + proportional tax. */
  selectedItemsTotal: number;
  /** True when at least one item has a selected qty > 0. */
  hasSelectedItems: boolean;
  /** True when every selected item is at full quantity → eligible for `specific_items`. */
  allSelectedAtFullQty: boolean;
  /** Increment/decrement a single item's selected qty, clamped to [0, maxQty]. */
  updateItemQty: (itemId: string, maxQty: number, delta: number) => void;
}

/**
 * Item-selection state + the proportional tax-split math for items-mode
 * payments. CRITICAL: this is financial math — the rounding and proportional
 * split here are reproduced exactly as the screen + web client compute them.
 * Do not "clean up" the math.
 */
export function useItemPaymentSubtotal({
  unpaidItems,
  orderSubtotal,
  orderTax,
}: UseItemPaymentSubtotalArgs): UseItemPaymentSubtotalResult {
  // Per-item selected qty (0 = unselected). Maps to web's
  // `selectedItemQuantities` for parity in `payment_type === 'specific_items'`.
  const [selectedItemQuantities, setSelectedItemQuantities] = useState<Map<string, number>>(
    () => new Map(),
  );

  // Selected items subtotal (pre-tax).
  const selectedSubtotal = useMemo(() => {
    let total = 0;
    for (const [itemId, qty] of selectedItemQuantities) {
      if (qty <= 0) continue;
      const item = unpaidItems.find((i) => i.id === itemId);
      if (item) total += qty * item.item_price;
    }
    return total;
  }, [selectedItemQuantities, unpaidItems]);

  // Proportional tax share for the selected slice. Mirrors web's calc.
  const selectedTax = useMemo(() => {
    if (orderTax <= 0 || orderSubtotal <= 0) return 0;
    return Math.round((selectedSubtotal / orderSubtotal) * orderTax * 100) / 100;
  }, [selectedSubtotal, orderSubtotal, orderTax]);

  const selectedItemsTotal = selectedSubtotal + selectedTax;

  const hasSelectedItems = useMemo(
    () => Array.from(selectedItemQuantities.values()).some((q) => q > 0),
    [selectedItemQuantities],
  );

  // All selected items at full quantity → eligible for `specific_items`
  // payment_type (DB trigger validates amount == items subtotal without tax).
  const allSelectedAtFullQty = useMemo(() => {
    for (const [itemId, qty] of selectedItemQuantities) {
      if (qty <= 0) continue;
      const item = unpaidItems.find((i) => i.id === itemId);
      if (item && qty < item.quantity) return false;
    }
    return true;
  }, [selectedItemQuantities, unpaidItems]);

  const updateItemQty = (itemId: string, maxQty: number, delta: number) => {
    setSelectedItemQuantities((prev) => {
      const next = new Map(prev);
      const cur = next.get(itemId) || 0;
      const target = Math.max(0, Math.min(maxQty, cur + delta));
      if (target === 0) next.delete(itemId);
      else next.set(itemId, target);
      return next;
    });
  };

  return {
    selectedItemQuantities,
    selectedSubtotal,
    selectedTax,
    selectedItemsTotal,
    hasSelectedItems,
    allSelectedAtFullQty,
    updateItemQty,
  };
}
