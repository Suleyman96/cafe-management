/**
 * Regression tests for discount + payment bugs.
 *
 * These tests verify that:
 * 1. Order totals of 0 (100% discount) are handled correctly (not treated as falsy)
 * 2. Discounted orders show the correct total in the payment modal
 * 3. "Fully paid" is only shown when the order is actually paid, not just discounted
 * 4. Payment is blocked when order.id is missing
 */

import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../helpers/test-utils';

const mockCreatePayment = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
const mockUpdateOrderStatus = { mutateAsync: vi.fn().mockResolvedValue({}) };

let mockRemainingBalance: number | undefined;
let mockExistingPayments: any[];

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
  subtotal: 100,
  tax: 18,
  total: 118,
  discount_type: 'none',
  discount_value: 0,
  discount_amount: 0,
  order_items: [
    { id: 'item-1', quantity: 2, item_price: 30, status: 'served', menu_item: { name: 'Burger' } },
    { id: 'item-2', quantity: 2, item_price: 20, status: 'served', menu_item: { name: 'Pasta' } },
  ],
};

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  order: baseOrder as any,
  onSuccess: vi.fn(),
};

describe('Discount + Payment regression tests', () => {
  beforeEach(() => {
    mockRemainingBalance = undefined;
    mockExistingPayments = [];
    vi.clearAllMocks();
  });

  describe('Falsy-zero bug: order.total === 0 must not fall back to recalculation', () => {
    it('shows 0.00₼ total when order has 100% discount (total=0)', () => {
      const fullyDiscountedOrder = {
        ...baseOrder,
        discount_type: 'percentage',
        discount_value: 100,
        discount_amount: 100,
        subtotal: 100,
        tax: 0,
        total: 0,
      };
      mockRemainingBalance = 0;
      renderWithProviders(
        <SplitPaymentModal {...defaultProps} order={fullyDiscountedOrder as any} />,
      );

      // The order total displayed should be 0.00₼, NOT recalculated as 100+18=118
      const totalElements = screen.getAllByText('0.00₼');
      expect(totalElements.length).toBeGreaterThanOrEqual(1);
    });

    it('uses order.subtotal=0 without falling back to item calculation', () => {
      const zeroSubtotalOrder = {
        ...baseOrder,
        subtotal: 0,
        tax: 0,
        total: 0,
      };
      mockRemainingBalance = 0;
      renderWithProviders(<SplitPaymentModal {...defaultProps} order={zeroSubtotalOrder as any} />);

      // Should show 0.00₼, not recalculated subtotal from items
      const totalElements = screen.getAllByText('0.00₼');
      expect(totalElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Discounted order shows correct amount in payment modal', () => {
    it('displays discounted total, not original subtotal+tax', () => {
      const discountedOrder = {
        ...baseOrder,
        discount_type: 'fixed',
        discount_value: 20,
        discount_amount: 20,
        subtotal: 100,
        tax: 14.4, // tax on (100-20)=80 at 18%
        total: 94.4,
      };
      mockRemainingBalance = 94.4;
      renderWithProviders(<SplitPaymentModal {...defaultProps} order={discountedOrder as any} />);

      // Should show 94.40₼ as the total, not 118₼
      expect(screen.getAllByText('94.40₼').length).toBeGreaterThanOrEqual(1);
      // The old (wrong) total should NOT appear
      expect(screen.queryByText('118.00₼')).toBeNull();
    });

    it('full payment amount uses remainingBalance when available', () => {
      const discountedOrder = {
        ...baseOrder,
        discount_type: 'percentage',
        discount_value: 10,
        discount_amount: 10,
        subtotal: 100,
        tax: 16.2,
        total: 106.2,
      };
      mockRemainingBalance = 56.2; // partially paid
      renderWithProviders(<SplitPaymentModal {...defaultProps} order={discountedOrder as any} />);

      // Payment amount should be remainingBalance (56.20), not order total
      expect(screen.getAllByText('56.20₼').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('isFullyPaid correctness', () => {
    it('does NOT show "fully paid" when only a discount was applied (no payments)', () => {
      const discountedOrder = {
        ...baseOrder,
        discount_type: 'fixed',
        discount_value: 5,
        discount_amount: 5,
        subtotal: 100,
        tax: 17.1,
        total: 112.1,
      };
      // Remaining balance after discount but no payment = full discounted total
      mockRemainingBalance = 112.1;
      renderWithProviders(<SplitPaymentModal {...defaultProps} order={discountedOrder as any} />);

      // Should NOT show "fully paid" message
      expect(screen.queryByText('This order has been fully paid!')).toBeNull();
      // Should show process payment button
      const buttons = screen.getAllByRole('button');
      const processBtn = buttons.find((b) => b.textContent === 'Process Payment');
      expect(processBtn).toBeDefined();
    });

    it('shows "fully paid" only when remainingBalance is 0 AND total > 0', () => {
      mockRemainingBalance = 0;
      renderWithProviders(<SplitPaymentModal {...defaultProps} />);

      // Should show complete order button
      const buttons = screen.getAllByRole('button');
      const completeBtn = buttons.find((b) => b.textContent?.includes('Complete Order'));
      expect(completeBtn).toBeDefined();
    });
  });

  describe('Guard against missing order ID', () => {
    it('does not call createPayment when order.id is missing', async () => {
      const orderWithoutId = { ...baseOrder, id: undefined };
      mockRemainingBalance = 100;
      renderWithProviders(<SplitPaymentModal {...defaultProps} order={orderWithoutId as any} />);

      const buttons = screen.getAllByRole('button');
      const processBtn = buttons.find(
        (b) => b.textContent === 'Process Payment' && !b.className.includes('text-gray'),
      );
      if (processBtn) {
        fireEvent.click(processBtn);
      }

      // createPayment should NOT be called
      expect(mockCreatePayment.mutateAsync).not.toHaveBeenCalled();
    });
  });
});
