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
let mockThreshold = 100;

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

vi.mock('@gustri/queries', async () => {
  // Preserve the real module so DbProvider, useStableClientRequestId, etc.
  // keep working — only override the cafe-settings hook so individual
  // tests can drive the threshold above/below the entered amount.
  const actual = await vi.importActual<typeof import('@gustri/queries')>('@gustri/queries');
  return {
    ...actual,
    useCafeSettings: () => ({
      data: { refund_type_to_confirm_threshold: mockThreshold },
      isLoading: false,
    }),
  };
});

import { RefundModal } from '@/components/modals/refund-modal';

const defaultProps = {
  isOpen: true,
  orderId: 'o1',
  totalPaid: 100,
  totalRefunded: 0,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

const fillForm = (amount = '50') => {
  const amountInput = screen.getByPlaceholderText('0.00');
  fireEvent.change(amountInput, { target: { value: amount } });
  const reasonTextarea = screen.getByPlaceholderText('orders.refundReason');
  fireEvent.change(reasonTextarea, { target: { value: 'damaged item' } });
};

const clickContinue = () => {
  const btn = screen.getByRole('button', { name: 'continue' });
  fireEvent.click(btn);
};

const clickConfirm = () => {
  // Confirm-step CTA. The mock i18n returns the raw key when missing,
  // so we look up `refunds.confirmCta`.
  const btn = screen.getByRole('button', { name: 'refunds.confirmCta' });
  fireEvent.click(btn);
};

beforeEach(() => {
  mockIsOnlineValue = true;
  mockCanIssueRefund = true;
  mockThreshold = 100;
  mockCreateRefund.isPending = false;
  mockCreateRefund.mutateAsync = vi
    .fn<(...args: unknown[]) => Promise<unknown>>()
    .mockResolvedValue({ id: 'refund-1' });
});

describe('RefundModal — two-step flow', () => {
  it('does not auto-retry on mutation failure (retry: 0 enforced)', async () => {
    // The hook sets `retry: 0` and the global QueryClient default does
    // too — even with the mutation rejecting, mutateAsync must be invoked
    // exactly once per click. A regression here would silently re-submit
    // money mutations on a network blip.
    mockCreateRefund.mutateAsync = vi
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockRejectedValue(new Error('network blip'));

    // Below threshold so no type-to-confirm input is required.
    mockThreshold = 1000;
    renderWithProviders(<RefundModal {...defaultProps} />);
    fillForm('50');
    clickContinue();
    clickConfirm();

    await waitFor(() => expect(mockCreateRefund.mutateAsync).toHaveBeenCalledTimes(1));
    // Give any rogue retry a chance to fire.
    await new Promise((r) => setTimeout(r, 20));
    expect(mockCreateRefund.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('disables continue when offline and never advances to the confirm step', () => {
    mockIsOnlineValue = false;
    renderWithProviders(<RefundModal {...defaultProps} />);
    fillForm();

    const continueBtn = screen.getByRole('button', { name: 'continue' }) as HTMLButtonElement;
    expect(continueBtn.disabled).toBe(true);

    fireEvent.click(continueBtn);
    // Still on form step — confirm CTA is not in the DOM.
    expect(screen.queryByRole('button', { name: 'refunds.confirmCta' })).toBeNull();
    expect(mockCreateRefund.mutateAsync).not.toHaveBeenCalled();
  });

  it('disables continue when the user lacks issue_refund permission', () => {
    mockCanIssueRefund = false;
    renderWithProviders(<RefundModal {...defaultProps} />);
    fillForm();

    const continueBtn = screen.getByRole('button', { name: 'continue' }) as HTMLButtonElement;
    expect(continueBtn.disabled).toBe(true);

    fireEvent.click(continueBtn);
    expect(mockCreateRefund.mutateAsync).not.toHaveBeenCalled();
  });

  it('reuses the same client_request_id on a user-driven retry through the confirm step', async () => {
    // Simulate the failure-then-success sequence a user would walk through
    // after a transient error: first confirm rejects, second confirm
    // succeeds. The server dedupes via (tenant_id, client_request_id) so
    // both attempts MUST carry the same key, otherwise a successful retry
    // would be treated as a fresh refund and write twice.
    mockCreateRefund.mutateAsync = vi
      .fn<(...args: unknown[]) => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('500'))
      .mockResolvedValueOnce({ id: 'refund-1' });

    mockThreshold = 1000;
    renderWithProviders(<RefundModal {...defaultProps} />);
    fillForm('50');
    clickContinue();

    clickConfirm();
    await waitFor(() => expect(mockCreateRefund.mutateAsync).toHaveBeenCalledTimes(1));

    clickConfirm();
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

  it('disables confirm CTA while mutation is pending', () => {
    mockCreateRefund.isPending = true;
    mockThreshold = 1000;
    renderWithProviders(<RefundModal {...defaultProps} />);
    fillForm('50');
    clickContinue();

    // The stub i18n in __tests__/setup.ts maps `payment.processing` →
    // "Processing..." so the confirm button label flips when isPending is true.
    const submitBtn = screen.getByRole('button', {
      name: 'Processing...',
    }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it('skips the type-to-confirm input below the threshold', () => {
    mockThreshold = 100;
    renderWithProviders(<RefundModal {...defaultProps} />);
    fillForm('50'); // 50 < 100 threshold
    clickContinue();

    // No type-to-confirm input should be rendered.
    expect(screen.queryByPlaceholderText(/^REFUND /)).toBeNull();

    const confirmBtn = screen.getByRole('button', {
      name: 'refunds.confirmCta',
    }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(false);
  });

  it('requires exact phrase match above the threshold', async () => {
    mockThreshold = 100;
    renderWithProviders(<RefundModal {...defaultProps} totalPaid={500} />);
    fillForm('200'); // 200 ≥ 100 threshold
    clickContinue();

    const phraseInput = screen.getByPlaceholderText('REFUND 200') as HTMLInputElement;
    expect(phraseInput).not.toBeNull();

    const confirmBtn = screen.getByRole('button', {
      name: 'refunds.confirmCta',
    }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);

    // Wrong phrase keeps it disabled.
    fireEvent.change(phraseInput, { target: { value: 'REFUND 300' } });
    expect(confirmBtn.disabled).toBe(true);

    // Correct phrase enables submit (case-insensitive, trimmed).
    fireEvent.change(phraseInput, { target: { value: '  refund 200 ' } });
    expect(confirmBtn.disabled).toBe(false);

    fireEvent.click(confirmBtn);
    await waitFor(() => expect(mockCreateRefund.mutateAsync).toHaveBeenCalledTimes(1));
  });

  it('keeps form state when user goes back from confirm step', () => {
    mockThreshold = 1000;
    renderWithProviders(<RefundModal {...defaultProps} />);
    fillForm('50');
    clickContinue();

    // Step 2 is rendered. Two "back" controls exist (header arrow icon
    // and footer button). Click the footer one — the last match.
    const backBtns = screen.getAllByRole('button', { name: 'back' });
    fireEvent.click(backBtns[backBtns.length - 1]!);

    // Back on step 1 with the original values intact.
    const amountInput = screen.getByPlaceholderText('0.00') as HTMLInputElement;
    expect(amountInput.value).toBe('50');
    const reasonTextarea = screen.getByPlaceholderText(
      'orders.refundReason',
    ) as HTMLTextAreaElement;
    expect(reasonTextarea.value).toBe('damaged item');
  });
});
