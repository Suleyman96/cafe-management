import { DeliveryOrderStatus } from '@/components/order/delivery-order-status';
import { OrderStatus } from '@/components/order/order-status';
import { renderWithProviders, screen } from '../helpers/test-utils';

// Feature: "Price display uses correct currency across all pages"
// When a restaurant uses AZN (₼) with "after" position, ALL pages must show ₼, never €.

const mockFormatPrice = (amount: number) => `${amount.toFixed(2)}₼`;

vi.mock('@/hooks/use-format-price', () => ({
  useFormatPrice: () => mockFormatPrice,
}));

vi.mock('@/hooks/use-settings', () => ({
  useCafeSettings: () => ({
    data: {
      tax_enabled: true,
      tax_percentage: 18,
      tax_label: 'ƏDV',
      prices_include_tax: false,
      show_tax_separately: true,
      currency_symbol: '₼',
      currency_position: 'after',
      currency_decimal_places: 2,
      allow_item_notes: true,
      allow_order_notes: true,
    },
  }),
  calculateTax: (subtotal: number) => subtotal * 0.18,
  calculateTotal: (subtotal: number) => subtotal * 1.18,
  getDisplaySubtotal: (subtotal: number) => subtotal,
  formatPrice: (amount: number) => `${amount.toFixed(2)}₼`,
}));

vi.mock('@/hooks/use-table', () => ({
  useTable: () => ({
    data: { id: 'uuid-table-1', table_number: 'T01' },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/use-order', () => ({
  useOrder: () => ({
    data: {
      id: 'order-1',
      order_number: '#001',
      table_id: 'uuid-table-1',
      table: { table_number: 'T01' },
      status: 'preparing',
      created_at: new Date().toISOString(),
      subtotal: 50,
      tax: 9,
      total: 59,
      order_items: [
        {
          id: 'i1',
          item_name: 'Latte',
          item_price: 10,
          quantity: 2,
          status: 'preparing',
          notes: null,
        },
        {
          id: 'i2',
          item_name: 'Cake',
          item_price: 15,
          quantity: 2,
          status: 'pending',
          notes: null,
        },
      ],
    },
    isLoading: false,
  }),
  useCancelOrder: () => ({ mutateAsync: vi.fn() }),
  useCancelOrderItem: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/hooks/use-delivery', () => ({
  useDeliveryOrder: () => ({
    data: {
      id: 'del-1',
      order_number: '#D001',
      status: 'out_for_delivery',
      created_at: new Date().toISOString(),
      customer_name: 'John',
      customer_phone: '+994501234567',
      delivery_address: '123 Main St',
      delivery_notes: null,
      delivery_person: null,
      delivery_fee: 3,
      subtotal: 40,
      tax: 7.2,
      total: 47.2,
      order_items: [
        {
          id: 'd1',
          item_name: 'Pizza',
          item_price: 25,
          quantity: 1,
          status: 'ready',
          notes: null,
        },
        {
          id: 'd2',
          item_name: 'Salad',
          item_price: 15,
          quantity: 1,
          status: 'ready',
          notes: null,
        },
      ],
    },
    isLoading: false,
  }),
}));

// Mock non-essential child components to keep tests focused
vi.mock('@/components/ui/platform-footer', () => ({
  PlatformFooter: () => null,
}));

describe('Price display uses correct currency across all pages', () => {
  it('order-status renders item prices with ₼ currency', () => {
    renderWithProviders(<OrderStatus tableId="T01" />);

    // Latte: 10 * 2 = 20
    expect(screen.getByText('20.00₼')).toBeInTheDocument();
    // Cake: 15 * 2 = 30
    expect(screen.getByText('30.00₼')).toBeInTheDocument();
  });

  it('order-status renders subtotal, tax, and total with ₼ currency', () => {
    renderWithProviders(<OrderStatus tableId="T01" />);

    expect(screen.getByText('50.00₼')).toBeInTheDocument();
    expect(screen.getByText('9.00₼')).toBeInTheDocument();
    expect(screen.getByText('59.00₼')).toBeInTheDocument();
  });

  it('delivery-order-status renders item prices with ₼ currency', () => {
    renderWithProviders(<DeliveryOrderStatus orderId="del-1" />);

    // Pizza: 25 * 1 = 25
    expect(screen.getByText('25.00₼')).toBeInTheDocument();
    // Salad: 15 * 1 = 15
    expect(screen.getByText('15.00₼')).toBeInTheDocument();
  });

  it('delivery-order-status adds delivery fee to total for display', () => {
    renderWithProviders(<DeliveryOrderStatus orderId="del-1" />);

    // DB total (47.20) = subtotal + tax, delivery_fee (3.00) added at display time
    // Grand total shown to customer: 47.20 + 3.00 = 50.20
    expect(screen.getByText('50.20₼')).toBeInTheDocument();
  });
});
