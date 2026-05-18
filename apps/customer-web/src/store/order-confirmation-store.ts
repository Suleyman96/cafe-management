import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * M1 — transient confirmation surface state.
 *
 * The submit flow used to be `toast.success(…) + router.push(…)`: the
 * toast auto-dismisses in ~3s, and on a slow phone the route push can
 * take several more seconds. In that gap the customer sees neither
 * confirmation nor the destination screen and starts wondering whether
 * to retap "Place Order" — exactly the anxiety C1 dedupe was built to
 * tolerate. This store backs a full-screen overlay that shows the
 * order number, item count, and total immediately on submit success,
 * with an explicit "Track Order" button that drives the navigation.
 *
 * State lifecycle:
 *   - `show({...})` on mutation success.
 *   - `dismiss()` on the explicit Track Order tap (which also navigates)
 *     or on a fallback auto-timer in the consumer (~15s).
 *
 * CR3 — persisted to **sessionStorage** so a mid-overlay page refresh
 * (flaky 3G triggering a browser reload, iOS memory-pressure tab kill,
 * accidental pull-to-refresh) re-renders the overlay with the same
 * order number rather than dumping the customer into an empty cart
 * with no confirmation that their order was placed. sessionStorage
 * (not localStorage) so the bearer-adjacent data dies with the tab
 * — there is no cross-tab/cross-session use case for showing a stale
 * "your order is placed" overlay.
 */

export type OrderConfirmationFlow = 'dine_in' | 'delivery';

export interface OrderConfirmationState {
  orderNumber: string;
  itemCount: number;
  total: number;
  flow: OrderConfirmationFlow;
  /** Path to navigate to when the customer taps Track Order. */
  trackHref: string;
}

interface OrderConfirmationStore {
  pending: OrderConfirmationState | null;
  show: (state: OrderConfirmationState) => void;
  dismiss: () => void;
}

export const useOrderConfirmationStore = create<OrderConfirmationStore>()(
  persist(
    (set) => ({
      pending: null,
      show: (state) => set({ pending: state }),
      dismiss: () => set({ pending: null }),
    }),
    {
      name: 'order-confirmation',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ pending: state.pending }),
    },
  ),
);
