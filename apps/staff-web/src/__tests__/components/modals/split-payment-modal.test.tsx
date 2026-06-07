import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAdminStaff } from '../../helpers/mock-auth';
import { renderWithProviders } from '../../helpers/test-utils';

// Configurable mutation + data surface. The modal pulls its query hooks from
// the `@/hooks` barrel, so all five are mocked there; auth / format / online /
// idempotency come from their own modules (mirrors refund-modal.test.tsx).
const mockCreatePayment = {
  mutateAsync: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  isPending: false,
};
const mockUpdateOrderStatus = {
  mutateAsync: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  isPending: false,
};

let mockRemainingBalance: number | undefined = 50;
let mockExistingPayments: unknown[] = [];
let mockIsOnlineValue = true;

vi.mock('@/hooks', () => ({
  useCreatePayment: () => mockCreatePayment,
  useUpdateOrderStatus: () => mockUpdateOrderStatus,
  useOrderRemainingBalance: () => ({ data: mockRemainingBalance }),
  useOrderPayments: () => ({ data: mockExistingPayments }),
  useCafeSettings: () => ({ data: { tips_enabled: false, currency_symbol: '$' } }),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ staff: mockAdminStaff, isLoading: false, isAuthenticated: true }),
}));

vi.mock('@/hooks/use-format-price', () => ({
  useFormatPrice: () => (n: number) => `$${n.toFixed(2)}`,
}));

vi.mock('@/hooks/use-is-online', () => ({
  useIsOnline: () => mockIsOnlineValue,
}));

vi.mock('@/hooks/use-persistent-client-request-id', () => ({
  usePersistentClientRequestId: () => ({
    get: () => '11111111-1111-4111-8111-111111111111',
    reset: vi.fn(),
  }),
}));

import { SplitPaymentModal } from '@/components/modals/split-payment-modal';

// Minimal order shaped enough for the modal: one served item, no tax, total 50.
const makeOrder = () =>
  ({
    id: 'o1',
    subtotal: 50,
    tax: 0,
    total: 50,
    order_items: [{ id: 'i1', quantity: 1, item_price: 50, status: 'served' }],
  }) as never;

const defaultProps = () => ({
  isOpen: true,
  onClose: vi.fn(),
  order: makeOrder(),
  onSuccess: vi.fn(),
});

// The staff-web test i18n mock resolves keys to English; both the header
// (`processPaymentCash`) and the pay button (`processPaymentBtn`) map to
// "Process Payment", but only the latter is a <button>, so the role query is
// unambiguous.
const payBtn = () => screen.getByRole('button', { name: 'Process Payment' }) as HTMLButtonElement;

beforeEach(() => {
  mockRemainingBalance = 50;
  mockExistingPayments = [];
  mockIsOnlineValue = true;
  mockCreatePayment.isPending = false;
  mockUpdateOrderStatus.isPending = false;
  mockCreatePayment.mutateAsync = vi
    .fn<(...args: unknown[]) => Promise<unknown>>()
    .mockResolvedValue({ id: 'payment-1' });
  mockUpdateOrderStatus.mutateAsync = vi
    .fn<(...args: unknown[]) => Promise<unknown>>()
    .mockResolvedValue({ id: 'o1' });
});

describe('SplitPaymentModal', () => {
  it('renders nothing when no order is provided', () => {
    const { container } = renderWithProviders(
      <SplitPaymentModal {...defaultProps()} order={undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when closed', () => {
    const { container } = renderWithProviders(
      <SplitPaymentModal {...defaultProps()} isOpen={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('enables the pay button for an unpaid order in full mode', () => {
    renderWithProviders(<SplitPaymentModal {...defaultProps()} />);
    expect(payBtn().disabled).toBe(false);
  });

  it('disables the pay button when offline', () => {
    mockIsOnlineValue = false;
    renderWithProviders(<SplitPaymentModal {...defaultProps()} />);
    expect(payBtn().disabled).toBe(true);
  });

  it('pays the full remaining balance with payment_type "full"', async () => {
    renderWithProviders(<SplitPaymentModal {...defaultProps()} />);
    fireEvent.click(payBtn());

    await vi.waitFor(() => expect(mockCreatePayment.mutateAsync).toHaveBeenCalledTimes(1));
    const arg = mockCreatePayment.mutateAsync.mock.calls[0]![0] as {
      order_id?: string;
      amount?: number;
      payment_type?: string;
      received_by?: string;
      client_request_id?: string;
    };
    expect(arg.order_id).toBe('o1');
    expect(arg.payment_type).toBe('full');
    expect(arg.amount).toBe(50); // remainingBalance, not orderTotal
    expect(arg.received_by).toBe(mockAdminStaff.id);
    expect(arg.client_request_id).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('shows the complete-order CTA instead of pay once the balance is settled', () => {
    mockRemainingBalance = 0;
    renderWithProviders(<SplitPaymentModal {...defaultProps()} />);
    expect(screen.queryByRole('button', { name: 'Process Payment' })).toBeNull();
    const complete = screen.getByRole('button', {
      name: 'Complete Order',
    }) as HTMLButtonElement;
    expect(complete.disabled).toBe(false);
  });
});
