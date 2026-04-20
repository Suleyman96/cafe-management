import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DeliveryStore {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryNotes: string;
  lastOrderId: string | null;
  setCustomerInfo: (name: string, phone: string, address: string, notes: string) => void;
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

      setCustomerInfo: (name, phone, address, notes) =>
        set({
          customerName: name,
          customerPhone: phone,
          deliveryAddress: address,
          deliveryNotes: notes,
        }),

      setLastOrderId: (id) => set({ lastOrderId: id }),

      clearDeliveryInfo: () =>
        set({
          customerName: '',
          customerPhone: '',
          deliveryAddress: '',
          deliveryNotes: '',
          lastOrderId: null,
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
