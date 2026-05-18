import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Delivery flow state, sliced across three storage classes by sensitivity:
 *
 *   - PII (name / phone / address / notes): **in-memory only**. CR2 —
 *     persisting these to localStorage was a shared-device leak (kiosk,
 *     family iPad) where the next visitor would see the previous
 *     customer's address pre-filled. The form re-collects on a fresh
 *     visit; the trade-off is one extra typing pass for repeat
 *     customers vs. zero residue for everyone else.
 *
 *   - `qrToken` (tenant-bearer secret): **sessionStorage**. CR1 — this
 *     is a credential the server uses to derive `tenant_id`. localStorage
 *     persisted it indefinitely with no TTL, so a shared device retained
 *     a usable bearer for tenant A long after the customer left. sessionStorage
 *     dies with the tab, which matches the natural QR-scan flow: a
 *     fresh tab is a fresh authorization.
 *
 *   - `lastOrderId`: **localStorage**. Benign reference (the customer's
 *     own order id), used for "Track Order" recovery across sessions.
 *
 * Cross-tab `storage`-event sync is intentionally **not** wired here.
 * Previously a naive listener piped any `delivery-storage` JSON payload
 * straight into the store with no shape validation (S2). Since qrToken
 * is now per-tab (sessionStorage) and PII is in-memory, no UX depends on
 * cross-tab sync — keeping the listener would only re-introduce a leak
 * path for `lastOrderId` and a defensively-naive parser.
 */

interface DeliveryStore {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryNotes: string;
  lastOrderId: string | null;
  qrToken: string | null;
  setCustomerInfo: (name: string, phone: string, address: string, notes: string) => void;
  setQrToken: (token: string | null) => void;
  setLastOrderId: (id: string) => void;
  // S1 — wipe PII after a successful order so a shared device (kiosk,
  // family iPad) doesn't pre-fill the next visitor's form with the
  // previous customer's name/phone/address. Distinct from
  // `clearDeliveryInfo` (full reset) and `clearQrToken` (bearer wipe)
  // so call sites keep intent explicit — mid-flow nav must NOT wipe.
  clearCustomerInfo: () => void;
  // S2 — drop the bearer secret after success. The customer rescans
  // the table-tent QR for the next delivery order; the natural path.
  clearQrToken: () => void;
  clearDeliveryInfo: () => void;
}

// CR1 — sessionStorage handle for the bearer. We read on store init so
// the value survives a same-tab refresh / route transition, and write on
// every `setQrToken` so the in-memory value and sessionStorage stay in
// lockstep. Wrapped in try/catch because Safari private mode throws on
// sessionStorage access.
const SESSION_QR_TOKEN_KEY = 'delivery-qr-token';

function readQrTokenFromSession(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(SESSION_QR_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeQrTokenToSession(token: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (token == null) {
      window.sessionStorage.removeItem(SESSION_QR_TOKEN_KEY);
    } else {
      window.sessionStorage.setItem(SESSION_QR_TOKEN_KEY, token);
    }
  } catch {
    // Private-mode rejection; in-memory state still works for this tab.
  }
}

export const useDeliveryStore = create<DeliveryStore>()(
  persist(
    (set) => ({
      customerName: '',
      customerPhone: '',
      deliveryAddress: '',
      deliveryNotes: '',
      lastOrderId: null,
      qrToken: readQrTokenFromSession(),

      setCustomerInfo: (name, phone, address, notes) =>
        set({
          customerName: name,
          customerPhone: phone,
          deliveryAddress: address,
          deliveryNotes: notes,
        }),

      setQrToken: (token) => {
        writeQrTokenToSession(token);
        set({ qrToken: token });
      },

      setLastOrderId: (id) => set({ lastOrderId: id }),

      clearCustomerInfo: () =>
        set({
          customerName: '',
          customerPhone: '',
          deliveryAddress: '',
          deliveryNotes: '',
        }),

      clearQrToken: () => {
        writeQrTokenToSession(null);
        set({ qrToken: null });
      },

      clearDeliveryInfo: () => {
        writeQrTokenToSession(null);
        set({
          customerName: '',
          customerPhone: '',
          deliveryAddress: '',
          deliveryNotes: '',
          lastOrderId: null,
          qrToken: null,
        });
      },
    }),
    {
      name: 'delivery-storage',
      storage: createJSONStorage(() => localStorage),
      // CR1 / CR2 — whitelist what gets persisted to localStorage. PII
      // and the bearer secret are handled separately (in-memory and
      // sessionStorage respectively). Only the benign order-id reference
      // survives across tabs/sessions.
      partialize: (state) => ({ lastOrderId: state.lastOrderId }),
    },
  ),
);

/**
 * Test-only helper. The cross-tab `storage`-event listener that used to
 * live here was removed (see file header) so this is a no-op kept for
 * backwards-compatible test imports.
 */
export function cleanupDeliveryStoreSync() {
  // intentional no-op
}
