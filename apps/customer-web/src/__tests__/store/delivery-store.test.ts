import { useDeliveryStore } from '@/store/delivery-store';

const SESSION_QR_TOKEN_KEY = 'delivery-qr-token';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useDeliveryStore.setState({
    customerName: '',
    customerPhone: '',
    deliveryAddress: '',
    deliveryNotes: '',
    lastOrderId: null,
    qrToken: null,
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

  describe('clearCustomerInfo (S1)', () => {
    it('wipes PII fields but preserves qrToken and lastOrderId', () => {
      useDeliveryStore.getState().setCustomerInfo('John', '123', 'Address', 'Notes');
      useDeliveryStore.getState().setQrToken('bearer-abc');
      useDeliveryStore.getState().setLastOrderId('order-1');

      useDeliveryStore.getState().clearCustomerInfo();

      const state = useDeliveryStore.getState();
      expect(state.customerName).toBe('');
      expect(state.customerPhone).toBe('');
      expect(state.deliveryAddress).toBe('');
      expect(state.deliveryNotes).toBe('');
      // Preserved — the order tracking page still needs both
      expect(state.qrToken).toBe('bearer-abc');
      expect(state.lastOrderId).toBe('order-1');
    });
  });

  describe('clearQrToken (S2)', () => {
    it('drops the bearer secret but preserves PII and lastOrderId', () => {
      useDeliveryStore.getState().setCustomerInfo('John', '123', 'Address', 'Notes');
      useDeliveryStore.getState().setQrToken('bearer-abc');
      useDeliveryStore.getState().setLastOrderId('order-1');

      useDeliveryStore.getState().clearQrToken();

      const state = useDeliveryStore.getState();
      expect(state.qrToken).toBeNull();
      // S1/S2 are intentionally separate methods so call sites stay explicit;
      // calling one must NOT wipe the other's data.
      expect(state.customerName).toBe('John');
      expect(state.lastOrderId).toBe('order-1');
    });
  });

  describe('clearDeliveryInfo', () => {
    it('resets all fields to defaults', () => {
      useDeliveryStore.getState().setCustomerInfo('John', '123', 'Address', 'Notes');
      useDeliveryStore.getState().setQrToken('bearer-abc');
      useDeliveryStore.getState().setLastOrderId('order-1');

      useDeliveryStore.getState().clearDeliveryInfo();

      const state = useDeliveryStore.getState();
      expect(state.customerName).toBe('');
      expect(state.customerPhone).toBe('');
      expect(state.deliveryAddress).toBe('');
      expect(state.deliveryNotes).toBe('');
      expect(state.lastOrderId).toBeNull();
      expect(state.qrToken).toBeNull();
    });
  });

  describe('CR1 — qrToken storage isolation', () => {
    it('writes qrToken to sessionStorage, not localStorage', () => {
      useDeliveryStore.getState().setQrToken('bearer-xyz');

      expect(sessionStorage.getItem(SESSION_QR_TOKEN_KEY)).toBe('bearer-xyz');
      // The persist middleware writes to localStorage under
      // `delivery-storage`; it must NOT contain the bearer.
      const persisted = localStorage.getItem('delivery-storage');
      if (persisted) {
        expect(persisted).not.toContain('bearer-xyz');
      }
    });

    it('clearQrToken wipes the sessionStorage entry', () => {
      useDeliveryStore.getState().setQrToken('bearer-xyz');
      expect(sessionStorage.getItem(SESSION_QR_TOKEN_KEY)).toBe('bearer-xyz');

      useDeliveryStore.getState().clearQrToken();
      expect(sessionStorage.getItem(SESSION_QR_TOKEN_KEY)).toBeNull();
    });

    it('clearDeliveryInfo wipes the sessionStorage entry', () => {
      useDeliveryStore.getState().setQrToken('bearer-xyz');
      useDeliveryStore.getState().clearDeliveryInfo();
      expect(sessionStorage.getItem(SESSION_QR_TOKEN_KEY)).toBeNull();
    });
  });

  describe('CR2 — PII storage isolation', () => {
    it('does not persist PII fields to localStorage', () => {
      useDeliveryStore
        .getState()
        .setCustomerInfo('John Doe', '+994551234567', '123 Main St', 'Ring the bell');
      useDeliveryStore.getState().setLastOrderId('order-1');

      const persisted = localStorage.getItem('delivery-storage');
      expect(persisted).toBeTruthy();
      // The persist payload should only contain lastOrderId — PII fields
      // must NOT round-trip through localStorage.
      expect(persisted).not.toContain('John Doe');
      expect(persisted).not.toContain('+994551234567');
      expect(persisted).not.toContain('123 Main St');
      expect(persisted).not.toContain('Ring the bell');
      expect(persisted).toContain('order-1');
    });
  });
});
