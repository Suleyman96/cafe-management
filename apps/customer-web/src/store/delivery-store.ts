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
