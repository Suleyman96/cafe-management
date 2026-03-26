import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../helpers/test-utils';

const mockCreatePayment = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
const mockUpdateOrderStatus = { mutateAsync: vi.fn().mockResolvedValue({}) };

let mockRemainingBalance: number | undefined = 100;
let mockExistingPayments: any[] = [];

vi.mock('@/hooks', () => ({
  useCreatePayment: () => mockCreatePayment,
  useUpdateOrderStatus: () => mockUpdateOrderStatus,
  useOrderRemainingBalance: () => ({ data: mockRemainingBalance }),
  useOrderPayments: () => ({ data: mockExistingPayments }),
  useCafeSettings: () => ({
    data: { currency_symbol: '₼', tips_enabled: false },
  }),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ staff: { id: 'staff-1' } }),
}));

vi.mock('@/hooks/use-format-price', () => ({
  useFormatPrice: () => (amount: number) => `${amount.toFixed(2)}₼`,
}));

vi.mock('@/components/modals/payment/payment-mode-selector', () => ({
  PaymentModeSelector: ({ paymentMode, onModeChange }: any) => (
    <div data-testid="mode-selector">
      <button onClick={() => onModeChange('full')}>Full</button>
      <button onClick={() => onModeChange('partial')}>Partial</button>
      <button onClick={() => onModeChange('items')}>Items</button>
      <span data-testid="current-mode">{paymentMode}</span>
    </div>
  ),
}));

vi.mock('@/components/modals/payment/partial-payment-form', () => ({
  PartialPaymentForm: ({ partialAmount, onAmountChange }: any) => (
    <input
      data-testid="partial-amount"
      value={partialAmount}
      onChange={(e) => onAmountChange(e.target.value)}
    />
  ),
}));

vi.mock('@/components/modals/payment/item-payment-form', () => ({
  ItemPaymentForm: () => <div data-testid="item-form">Item Form</div>,
}));

import { SplitPaymentModal } from '@/components/modals/split-payment-modal';

const baseOrder = {
  id: 'order-1',
  subtotal: 80,
  tax: 20,
  total: 100,
  order_items: [
    { id: 'item-1', quantity: 2, item_price: 25, status: 'served', menu_item: { name: 'Burger' } },
    { id: 'item-2', quantity: 1, item_price: 30, status: 'served', menu_item: { name: 'Steak' } },
  ],
};

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  order: baseOrder as any,
  onSuccess: vi.fn(),
};

describe('Payment processing correctness', () => {
  beforeEach(() => {
    mockRemainingBalance = 100;
    mockExistingPayments = [];
    vi.clearAllMocks();
  });

  it('full mode shows remaining balance as payment amount', () => {
    mockRemainingBalance = 75;
    renderWithProviders(<SplitPaymentModal {...defaultProps} />);

    // The amount 75.00₼ appears in the summary section
    const amounts = screen.getAllByText('75.00₼');
    expect(amounts.length).toBeGreaterThanOrEqual(1);
  });

  it('payment method defaults to cash and allows selection', () => {
    renderWithProviders(<SplitPaymentModal {...defaultProps} />);

    const cashBtn = screen.getByText('Cash');
    const cardBtn = screen.getByText('Card');
    const digitalBtn = screen.getByText('Digital');

    expect(cashBtn).toBeDefined();
    expect(cardBtn).toBeDefined();
    expect(digitalBtn).toBeDefined();

    // Cash should be selected by default (has blue styling)
    expect(cashBtn.closest('button')?.className).toContain('bg-blue-100');
  });

  it('selected payment method is passed to createPayment mutation', async () => {
    renderWithProviders(<SplitPaymentModal {...defaultProps} />);

    // Select 'card' payment method
    fireEvent.click(screen.getByText('Card'));

    // Find the process payment button (not the title)
    const buttons = screen.getAllByRole('button');
    const processBtn = buttons.find(
      (b) => b.textContent === 'Process Payment' && !b.className.includes('text-gray'),
    );
    fireEvent.click(processBtn!);

    await vi.waitFor(() => {
      expect(mockCreatePayment.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method: 'card',
        }),
      );
    });
  });

  it('shows complete order button when fully paid', () => {
    mockRemainingBalance = 0;
    renderWithProviders(<SplitPaymentModal {...defaultProps} />);

    // The complete order button has an icon + text, search in button text content
    const buttons = screen.getAllByRole('button');
    const completeBtn = buttons.find((b) => b.textContent?.includes('Complete Order'));
    expect(completeBtn).toBeDefined();
  });

  it('shows complete order button for zero-total orders', () => {
    const zeroOrder = {
      ...baseOrder,
      subtotal: 0,
      tax: 0,
      total: 0,
      order_items: [],
    };
    renderWithProviders(<SplitPaymentModal {...defaultProps} order={zeroOrder as any} />);

    const buttons = screen.getAllByRole('button');
    const completeBtn = buttons.find((b) => b.textContent?.includes('Complete Order'));
    expect(completeBtn).toBeDefined();
  });

  it('process button is disabled when partial amount exceeds remaining balance', () => {
    mockRemainingBalance = 50;
    renderWithProviders(<SplitPaymentModal {...defaultProps} />);

    // Switch to partial mode
    fireEvent.click(screen.getByText('Partial'));

    const input = screen.getByTestId('partial-amount');
    fireEvent.change(input, { target: { value: '999' } });

    // The process button should be disabled since 999 > 50 + 0.01
    const buttons = screen.getAllByRole('button');
    const processBtn = buttons.find(
      (b) => b.textContent === 'Process Payment' && !b.className.includes('text-gray'),
    );
    expect(processBtn?.disabled).toBe(true);
  });

  it('payment method resets when modal reopens', () => {
    const { rerender } = renderWithProviders(<SplitPaymentModal {...defaultProps} />);

    // Select card
    fireEvent.click(screen.getByText('Card'));
    expect(screen.getByText('Card').closest('button')?.className).toContain('bg-blue-100');

    // Close and reopen
    rerender(<SplitPaymentModal {...defaultProps} isOpen={false} />);
    rerender(<SplitPaymentModal {...defaultProps} isOpen={true} />);

    // Cash should be selected again (reset)
    expect(screen.getByText('Cash').closest('button')?.className).toContain('bg-blue-100');
  });
});
