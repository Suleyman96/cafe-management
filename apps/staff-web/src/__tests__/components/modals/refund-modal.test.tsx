import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAdminStaff } from '../../helpers/mock-auth';
import { renderWithProviders } from '../../helpers/test-utils';

// Configurable mutation surface so individual tests can simulate
// pending / error / success without re-mocking the module.
const mockCreateRefund = {
  mutateAsync: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  isPending: false,
};

let mockIsOnlineValue = true;
let mockCanIssueRefund = true;

vi.mock('@/hooks', () => ({
  useCreateRefund: () => mockCreateRefund,
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

vi.mock('@/hooks/use-can-perform', () => ({
  useCanPerform: () => mockCanIssueRefund,
}));

import { RefundModal } from '@/components/modals/refund-modal';

const defaultProps = {
  isOpen: true,
  orderId: 'o1',
  totalPaid: 100,
  totalRefunded: 0,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

const fillValidForm = () => {
  // amount input is the first input on the page (NumberInput)
  const amountInput = screen.getByPlaceholderText('0.00');
  fireEvent.change(amountInput, { target: { value: '50' } });
  // reason textarea — placeholder mirrors the label key under our i18n stub
  const reasonTextarea = screen.getByPlaceholderText('orders.refundReason');
  fireEvent.change(reasonTextarea, { target: { value: 'damaged item' } });
};

const clickSubmit = () => {
  // Two buttons say "orders.processRefund" (header + footer); the footer
  // button is the submit. Pick the last match — it's the one that fires
  // the mutation.
  const buttons = screen.getAllByRole('button', { name: 'orders.processRefund' });
  fireEvent.click(buttons[buttons.length - 1]!);
};

beforeEach(() => {
  mockIsOnlineValue = true;
  mockCanIssueRefund = true;
  mockCreateRefund.isPending = false;
  mockCreateRefund.mutateAsync = vi
    .fn<(...args: unknown[]) => Promise<unknown>>()
    .mockResolvedValue({ id: 'refund-1' });
});

describe('RefundModal', () => {
  it('does not auto-retry on mutation failure (retry: 0 enforced)', async () => {
    // The hook sets `retry: 0` and the global QueryClient default does
    // too — even with the mutation rejecting, mutateAsync must be invoked
    // exactly once per click. A regression here would silently re-submit
    // money mutations on a network blip.
    mockCreateRefund.mutateAsync = vi
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockRejectedValue(new Error('network blip'));

    renderWithProviders(<RefundModal {...defaultProps} />);
    fillValidForm();
    clickSubmit();

    await waitFor(() => expect(mockCreateRefund.mutateAsync).toHaveBeenCalledTimes(1));
    // Give any rogue retry a chance to fire.
    await new Promise((r) => setTimeout(r, 20));
    expect(mockCreateRefund.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('disables submit when offline and never fires the mutation', () => {
    mockIsOnlineValue = false;

    renderWithProviders(<RefundModal {...defaultProps} />);
    fillValidForm();

    const buttons = screen.getAllByRole('button', { name: 'orders.processRefund' });
    const submitBtn = buttons[buttons.length - 1] as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    fireEvent.click(submitBtn);
    expect(mockCreateRefund.mutateAsync).not.toHaveBeenCalled();
  });

  it('disables submit when the user lacks issue_refund permission', () => {
    mockCanIssueRefund = false;

    renderWithProviders(<RefundModal {...defaultProps} />);
    fillValidForm();

    const buttons = screen.getAllByRole('button', { name: 'orders.processRefund' });
    const submitBtn = buttons[buttons.length - 1] as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    fireEvent.click(submitBtn);
    expect(mockCreateRefund.mutateAsync).not.toHaveBeenCalled();
  });

  it('reuses the same client_request_id on a user-driven retry', async () => {
    // Simulate the failure-then-success sequence a user would walk through
    // after a transient error: first click rejects, second click succeeds.
    // The server dedupes via (tenant_id, client_request_id) so both
    // attempts MUST carry the same key, otherwise a successful retry
    // would be treated as a fresh refund and write twice.
    mockCreateRefund.mutateAsync = vi
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('500'))
      .mockResolvedValueOnce({ id: 'refund-1' });

    renderWithProviders(<RefundModal {...defaultProps} />);
    fillValidForm();

    clickSubmit();
    await waitFor(() => expect(mockCreateRefund.mutateAsync).toHaveBeenCalledTimes(1));

    clickSubmit();
    await waitFor(() => expect(mockCreateRefund.mutateAsync).toHaveBeenCalledTimes(2));

    const firstArg = mockCreateRefund.mutateAsync.mock.calls[0]![0] as {
      client_request_id?: string;
    };
    const secondArg = mockCreateRefund.mutateAsync.mock.calls[1]![0] as {
      client_request_id?: string;
    };

    expect(firstArg.client_request_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(secondArg.client_request_id).toBe(firstArg.client_request_id);
  });

  it('disables submit while mutation is pending', () => {
    mockCreateRefund.isPending = true;

    renderWithProviders(<RefundModal {...defaultProps} />);
    fillValidForm();

    // The stub i18n in __tests__/setup.ts maps `payment.processing` →
    // "Processing..." so the submit label flips when isPending is true.
    const submitBtn = screen.getByRole('button', {
      name: 'Processing...',
    }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });
});
