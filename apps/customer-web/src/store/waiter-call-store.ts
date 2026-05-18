import { randomUUIDv4 } from '@gustri/queries';
import { create } from 'zustand';

/**
 * Session-scoped idempotency key for the "Call Staff" mutation (C2).
 *
 * Two surfaces fire `useCreateWaiterCall` from the same table session:
 * the FAB mounted in `app/table/[tableId]/layout.tsx` and the "Call
 * Staff" button inside `components/order/order-status.tsx`. Both are
 * mounted simultaneously while the customer is on `/table/[tableId]/order`,
 * so a per-component `useRef` would mint two different keys for what
 * the customer perceives as one logical request — a rapid double-tap
 * across surfaces would create two `waiter_calls` rows even with the
 * partial unique index in place.
 *
 * Lifting the key to a Zustand slice gives both surfaces the same id
 * for the current "pending call cycle". `consume()` is lazy (mints on
 * first read, returns the cached value thereafter); `reset()` is called
 * after a successful create so the next call cycle gets a fresh id.
 */

interface WaiterCallIdempotencyStore {
  pendingClientRequestId: string | null;
  consume: () => string;
  reset: () => void;
}

export const useWaiterCallIdempotency = create<WaiterCallIdempotencyStore>()((set, get) => ({
  pendingClientRequestId: null,
  consume: () => {
    const current = get().pendingClientRequestId;
    if (current) return current;
    const fresh = randomUUIDv4();
    set({ pendingClientRequestId: fresh });
    return fresh;
  },
  reset: () => {
    set({ pendingClientRequestId: null });
  },
}));
