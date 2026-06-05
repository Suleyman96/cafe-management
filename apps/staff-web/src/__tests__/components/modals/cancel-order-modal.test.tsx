import type { OrderWithDetails } from '@gustri/database/types';
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../helpers/test-utils';

const mockCancelOrder = {
  isPending: false,
  error: null,
  reset: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/hooks', () => ({
  useCancelOrder: () => mockCancelOrder,
  isOrderVersionConflict: () => false,
}));

import { CancelOrderModal } from '@/components/modals/cancel-order-modal';

// The setup.ts i18n mock returns the key if not in its dict — so we assert on
// keys (e.g. `orders.cancelOrder`) rather than English.
const CANCEL_BTN_KEY = 'orders.cancelOrder';
const REASON_PLACEHOLDER_KEY = 'orders.reasonPlaceholder';

function makeOrder(overrides: Partial<OrderWithDetails> = {}): OrderWithDetails {
  return {
    id: 'order-abcdef1234',
    order_number: '1042',
    status: 'preparing',
    table_id: null,
    ...overrides,
  } as unknown as OrderWithDetails;
}

function renderModal(orderOverrides: Partial<OrderWithDetails> = {}) {
  return renderWithProviders(
    <CancelOrderModal
      order={makeOrder(orderOverrides)}
      orderLabel="Table 5"
      title="Cancel order"
      onSuccess={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('CancelOrderModal — type-to-confirm gate', () => {
  it('shows the type-to-confirm input when status has kitchen labor invested', () => {
    renderModal({ status: 'preparing', order_number: '1042' });
    expect(screen.getByPlaceholderText('CANCEL')).toBeTruthy();
  });

  it('does NOT show the type-to-confirm input for early statuses', () => {
    renderModal({ status: 'new', order_number: '1042' });
    expect(screen.queryByPlaceholderText('CANCEL')).toBeNull();
  });

  it('keeps cancel button disabled while phrase has not been typed correctly', () => {
    renderModal({ status: 'preparing', order_number: '1042' });
    const textarea = screen.getByPlaceholderText(REASON_PLACEHOLDER_KEY) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Customer left' } });

    const cancelBtn = screen.getByRole('button', { name: new RegExp(CANCEL_BTN_KEY) });
    expect((cancelBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables cancel button once the phrase matches (case-insensitive)', () => {
    renderModal({ status: 'preparing', order_number: '1042' });
    const textarea = screen.getByPlaceholderText(REASON_PLACEHOLDER_KEY) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Customer left' } });

    const confirmInput = screen.getByPlaceholderText('CANCEL') as HTMLInputElement;
    fireEvent.change(confirmInput, { target: { value: 'cancel' } });

    const cancelBtn = screen.getByRole('button', { name: new RegExp(CANCEL_BTN_KEY) });
    expect((cancelBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('rejects a typed phrase that is not the keyword', () => {
    renderModal({ status: 'preparing', order_number: '1042' });
    const textarea = screen.getByPlaceholderText(REASON_PLACEHOLDER_KEY) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Customer left' } });

    const confirmInput = screen.getByPlaceholderText('CANCEL') as HTMLInputElement;
    fireEvent.change(confirmInput, { target: { value: 'CONFIRM' } });

    const cancelBtn = screen.getByRole('button', { name: new RegExp(CANCEL_BTN_KEY) });
    expect((cancelBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
