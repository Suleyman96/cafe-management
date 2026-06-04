import { create } from 'zustand';
import type { CartItem, MenuItem, SelectedOption } from '@/types';

/**
 * Composite identity for a cart line: the menu item plus the (order-independent)
 * set of selected option-value ids. Two adds of the same item with different
 * modifiers are distinct lines; with no modifiers the key collapses to the bare
 * menu-item id, so behavior is unchanged for items without options.
 */
export function cartLineKey(menuItemId: string, selectedOptions?: SelectedOption[]): string {
  const sig = (selectedOptions ?? [])
    .map((o) => o.valueId)
    .sort()
    .join(',');
  return sig ? `${menuItemId}#${sig}` : menuItemId;
}

/** Per-unit price including modifier deltas (base + Σ priceDelta). */
export function cartItemUnitPrice(item: CartItem): number {
  const delta = (item.selectedOptions ?? []).reduce((sum, o) => sum + o.priceDelta, 0);
  return item.menuItem.price + delta;
}

/**
 * Customer-web QR-ordering cart, partitioned by `(flow, tenantId, tableId?)`.
 *
 * Why partitioned: pre-M4 the cart was a single global, so a customer
 * who scanned tenant A's QR, added items, then opened `/delivery?token=B`
 * carried those items forward. The server then rejected because
 * `menu_item_id` is tenant-scoped via RLS, and the customer saw a
 * generic error with no way to recover. The cleanest fix is to make
 * the cart a *property of* the (flow, tenantId, tableId) tuple — not
 * a global piece of state — so navigating between contexts is an
 * automatic switch rather than a leaky carry-over.
 *
 * Why persisted (a reversal of the pre-M4 stance documented in the
 * earlier comment): with the partition key in place, persistence no
 * longer creates the cross-tenant leak it used to. The benefit — a
 * reload mid-session preserves the cart — comes back for free now.
 *
 * Storage shape: `localStorage` key per partition, value `{ items,
 * lastTouchedAt }`. Stale partitions older than `TTL_MS` are ignored
 * on load — a customer who scanned three days ago shouldn't have a
 * surprise pre-loaded cart waiting.
 *
 * The partition is set imperatively from the route layouts:
 *   - `app/table/[tableId]/layout.tsx` calls `setPartition({ flow:
 *     'dine_in', tenantId, tableId })` once `useTable` resolves.
 *   - `hooks/use-delivery-context.ts` calls `setPartition({ flow:
 *     'delivery', tenantId })` once the qr_token lookup resolves.
 *
 * Until a partition is set, the cart is read-only-ish: mutations are
 * still allowed (so legacy paths don't break) but they don't persist.
 * Persistence is opt-in via `setPartition`, not opt-out, so a forgotten
 * call site degrades gracefully instead of writing to a phantom key.
 */

export type CartFlow = 'dine_in' | 'delivery';

export interface CartPartition {
  flow: CartFlow;
  tenantId: string;
  tableId?: string;
}

interface PersistedCart {
  items: CartItem[];
  lastTouchedAt: number;
}

interface CartStore {
  items: CartItem[];
  partition: CartPartition | null;
  lastTouchedAt: number;
  addItem: (
    menuItem: MenuItem,
    quantity: number,
    notes?: string,
    selectedOptions?: SelectedOption[],
  ) => void;
  removeItem: (lineKey: string) => void;
  updateQuantity: (lineKey: string, quantity: number) => void;
  updateNotes: (lineKey: string, notes: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  /**
   * Swap the active partition. If the new partition is different, the
   * current items are flushed to disk under the old key and the new
   * key's items are loaded (or reset if missing/expired).
   */
  setPartition: (partition: CartPartition | null) => void;
}

// 4h freshness window. Long enough that a customer who paused for a
// snack returns to their cart; short enough that a stale session from
// yesterday doesn't re-surface uninvited. Matches the "session-bound"
// framing of QR-code ordering — the table changes hands faster than a
// day.
const TTL_MS = 4 * 60 * 60 * 1000;

function storageKey(p: CartPartition): string {
  // `_` sentinel for the delivery flow which has no table id, so the
  // key shape stays grep-able and the empty-segment doesn't collapse.
  return `cart:${p.flow}:${p.tenantId}:${p.tableId ?? '_'}`;
}

function safeStorage(): Storage | null {
  // The first commit after SSR runs on the server where `localStorage`
  // is absent. Guard with typeof rather than try/catch so we don't
  // swallow a real corruption error.
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function loadPartition(p: CartPartition): CartItem[] {
  const storage = safeStorage();
  if (!storage) return [];
  const raw = storage.getItem(storageKey(p));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PersistedCart;
    if (!parsed || !Array.isArray(parsed.items)) return [];
    if (typeof parsed.lastTouchedAt !== 'number' || Date.now() - parsed.lastTouchedAt > TTL_MS) {
      storage.removeItem(storageKey(p));
      return [];
    }
    // Backfill lineKey for carts persisted before modifiers existed.
    return parsed.items.map((item) => ({
      ...item,
      lineKey: item.lineKey ?? cartLineKey(item.menuItem.id, item.selectedOptions),
    }));
  } catch {
    // Corrupted JSON — drop it; better an empty cart than a runtime
    // throw on hydration.
    storage.removeItem(storageKey(p));
    return [];
  }
}

function savePartition(p: CartPartition, items: CartItem[], lastTouchedAt: number) {
  const storage = safeStorage();
  if (!storage) return;
  try {
    // Empty carts shouldn't pin a partition entry — frees the slot
    // when the customer clears or submits.
    if (items.length === 0) {
      storage.removeItem(storageKey(p));
      return;
    }
    const payload: PersistedCart = { items, lastTouchedAt };
    storage.setItem(storageKey(p), JSON.stringify(payload));
  } catch {
    // Quota exceeded / private mode rejection. Cart still works
    // in-memory; we just lose reload-survive on this device.
  }
}

function partitionsEqual(a: CartPartition | null, b: CartPartition | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.flow === b.flow && a.tenantId === b.tenantId && a.tableId === b.tableId;
}

export const useCartStore = create<CartStore>()((set, get) => {
  // Persist on every mutation. Pulled into a closure so each action
  // doesn't have to repeat the partition lookup + lastTouchedAt stamp.
  const persistMutation = (items: CartItem[]) => {
    const now = Date.now();
    const { partition } = get();
    if (partition) savePartition(partition, items, now);
    return now;
  };

  return {
    items: [],
    partition: null,
    lastTouchedAt: 0,

    addItem: (menuItem, quantity, notes, selectedOptions) => {
      const lineKey = cartLineKey(menuItem.id, selectedOptions);
      const existing = get().items.find((item) => item.lineKey === lineKey);
      const items = existing
        ? get().items.map((item) =>
            item.lineKey === lineKey
              ? { ...item, quantity: item.quantity + quantity, notes: notes || item.notes }
              : item,
          )
        : [...get().items, { menuItem, quantity, notes, selectedOptions, lineKey }];
      set({ items, lastTouchedAt: persistMutation(items) });
    },

    removeItem: (lineKey) => {
      const items = get().items.filter((item) => item.lineKey !== lineKey);
      set({ items, lastTouchedAt: persistMutation(items) });
    },

    updateQuantity: (lineKey, quantity) => {
      if (quantity <= 0) {
        get().removeItem(lineKey);
        return;
      }
      const items = get().items.map((item) =>
        item.lineKey === lineKey ? { ...item, quantity } : item,
      );
      set({ items, lastTouchedAt: persistMutation(items) });
    },

    updateNotes: (lineKey, notes) => {
      const items = get().items.map((item) =>
        item.lineKey === lineKey ? { ...item, notes } : item,
      );
      set({ items, lastTouchedAt: persistMutation(items) });
    },

    clearCart: () => {
      const now = Date.now();
      const { partition } = get();
      if (partition) savePartition(partition, [], now);
      set({ items: [], lastTouchedAt: now });
    },

    getTotal: () =>
      get().items.reduce((total, item) => total + cartItemUnitPrice(item) * item.quantity, 0),

    getItemCount: () => get().items.reduce((count, item) => count + item.quantity, 0),

    setPartition: (next) => {
      const { partition: prev, items } = get();
      if (partitionsEqual(prev, next)) return;

      // Flush whatever's in memory under the previous partition before
      // we swap — the customer may have added items before the
      // partition resolved (legacy path) or under the prior tenant.
      if (prev && items.length > 0) {
        savePartition(prev, items, get().lastTouchedAt || Date.now());
      }

      if (!next) {
        set({ partition: null, items: [], lastTouchedAt: 0 });
        return;
      }

      const loaded = loadPartition(next);
      set({ partition: next, items: loaded, lastTouchedAt: loaded.length > 0 ? Date.now() : 0 });
    },
  };
});
