import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DeliveryStore {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryNotes: string;
  lastOrderId: string | null;
  // Bearer secret from the delivery QR URL (?token=…). Required by the
  // staff-web `/api/v1/customer/orders` route to derive the tenant for
  // delivery orders (C1 — see qr_tokens migration).
  qrToken: string | null;
  setCustomerInfo: (name: string, phone: string, address: string, notes: string) => void;
  setQrToken: (token: string | null) => void;
  setLastOrderId: (id: string) => void;
  clearDeliveryInfo: () => void;
}

export const useDeliveryStore = create<DeliveryStore>()(
  persist(
    (set) => ({
      customerName: '',
      customerPhone: '',
      deliveryAddress: '',
      deliveryNotes: '',
      lastOrderId: null,
      qrToken: null,

      setCustomerInfo: (name, phone, address, notes) =>
        set({
          customerName: name,
          customerPhone: phone,
          deliveryAddress: address,
          deliveryNotes: notes,
        }),

      setQrToken: (token) => set({ qrToken: token }),

      setLastOrderId: (id) => set({ lastOrderId: id }),

      clearDeliveryInfo: () =>
        set({
          customerName: '',
          customerPhone: '',
          deliveryAddress: '',
          deliveryNotes: '',
          lastOrderId: null,
          qrToken: null,
        }),
    }),
    {
      name: 'delivery-storage',
    },
  ),
);

// Sync delivery info across browser tabs via storage events
function handleDeliveryStorageSync(e: StorageEvent) {
  if (e.key === 'delivery-storage' && e.newValue) {
    try {
      const parsed = JSON.parse(e.newValue);
      if (parsed.state) {
        useDeliveryStore.setState(parsed.state);
      }
    } catch {
      // Ignore malformed storage data
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', handleDeliveryStorageSync);
}

/** Remove the storage sync listener (useful for tests). */
export function cleanupDeliveryStoreSync() {
  if (typeof window !== 'undefined') {
    window.removeEventListener('storage', handleDeliveryStorageSync);
  }
}
