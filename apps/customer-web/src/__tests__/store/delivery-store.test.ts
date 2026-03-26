import { useDeliveryStore } from '@/store/delivery-store';

beforeEach(() => {
  localStorage.clear();
  useDeliveryStore.setState({
    customerName: '',
    customerPhone: '',
    deliveryAddress: '',
    deliveryNotes: '',
    lastOrderId: null,
  });
});

describe('useDeliveryStore', () => {
  describe('setCustomerInfo', () => {
    it('sets all 4 customer fields', () => {
      useDeliveryStore
        .getState()
        .setCustomerInfo('John Doe', '+994551234567', '123 Main St', 'Ring the bell');

      const state = useDeliveryStore.getState();
      expect(state.customerName).toBe('John Doe');
      expect(state.customerPhone).toBe('+994551234567');
      expect(state.deliveryAddress).toBe('123 Main St');
      expect(state.deliveryNotes).toBe('Ring the bell');
    });
  });

  describe('setLastOrderId', () => {
    it('sets order ID', () => {
      useDeliveryStore.getState().setLastOrderId('order-123');
      expect(useDeliveryStore.getState().lastOrderId).toBe('order-123');
    });
  });

  describe('clearDeliveryInfo', () => {
    it('resets all fields to defaults', () => {
      useDeliveryStore.getState().setCustomerInfo('John', '123', 'Address', 'Notes');
      useDeliveryStore.getState().setLastOrderId('order-1');

      useDeliveryStore.getState().clearDeliveryInfo();

      const state = useDeliveryStore.getState();
      expect(state.customerName).toBe('');
      expect(state.customerPhone).toBe('');
      expect(state.deliveryAddress).toBe('');
      expect(state.deliveryNotes).toBe('');
      expect(state.lastOrderId).toBeNull();
    });
  });
});
