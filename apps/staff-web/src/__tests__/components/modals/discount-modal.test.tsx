import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAdminStaff } from '../../helpers/mock-auth';
import { renderWithProviders } from '../../helpers/test-utils';

// Configurable mutation + gate surface (mirrors refund-modal.test.tsx).
const mockApplyDiscount = {
  mutateAsync: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  isPending: false,
};

let mockIsOnlineValue = true;
let mockCanApplyDiscount = true;
let mockThreshold = 100;

vi.mock('@/hooks', () => ({
  useApplyDiscount: () => mockApplyDiscount,
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
  useCanPerform: () => mockCanApplyDiscount,
}));

vi.mock('@gustri/queries', async () => {
  const actual = await vi.importActual<typeof import('@gustri/queries')>('@gustri/queries');
  return {
    ...actual,
    useCafeSettings: () => ({
      data: { refund_type_to_confirm_threshold: mockThreshold },
      isLoading: false,
    }),
  };
});

import { DiscountModal } from '@/components/modals/discount-modal';

const defaultProps = {
  isOpen: true,
  orderId: 'o1',
  orderSubtotal: 100,
  currentDiscountType: 'none' as const,
  currentDiscountValue: 0,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

// Default discount type is 'percentage' → the value input shows placeholder '10'.
const setValue = (v: string) => {
  fireEvent.change(screen.getByPlaceholderText('10'), { target: { value: v } });
};
const continueBtn = () => screen.getByRole('button', { name: 'continue' }) as HTMLButtonElement;

beforeEach(() => {
  mockIsOnlineValue = true;
  mockCanApplyDiscount = true;
  mockThreshold = 100;
  mockApplyDiscount.isPending = false;
  mockApplyDiscount.mutateAsync = vi
    .fn<(...args: unknown[]) => Promise<unknown>>()
    .mockResolvedValue({ id: 'order-1' });
});

describe('DiscountModal', () => {
  it('disables continue with no value entered', () => {
    renderWithProviders(<DiscountModal {...defaultProps} />);
    expect(continueBtn().disabled).toBe(true);
  });

  it('disables continue when offline', () => {
    mockIsOnlineValue = false;
    renderWithProviders(<DiscountModal {...defaultProps} />);
    setValue('10');
    expect(continueBtn().disabled).toBe(true);
  });

  it('disables continue when the user lacks apply_discount permission', () => {
    mockCanApplyDiscount = false;
    renderWithProviders(<DiscountModal {...defaultProps} />);
    setValue('10');
    expect(continueBtn().disabled).toBe(true);
  });

  it('does not advance to confirm for a percentage discount over 100%', () => {
    renderWithProviders(<DiscountModal {...defaultProps} />);
    setValue('150'); // >100% is nonsensical — the continue handler blocks it
    fireEvent.click(continueBtn());
    // Still on the form: the confirm-step CTA is not rendered.
    expect(screen.queryByRole('button', { name: 'discounts.confirmCta' })).toBeNull();
    expect(mockApplyDiscount.mutateAsync).not.toHaveBeenCalled();
  });

  it('only shows the Remove button when a discount is already applied', () => {
    const { rerender } = renderWithProviders(<DiscountModal {...defaultProps} />);
    expect(screen.queryByRole('button', { name: 'orders.removeDiscount' })).toBeNull();

    rerender(
      <DiscountModal {...defaultProps} currentDiscountType="fixed" currentDiscountValue={10} />,
    );
    expect(screen.getByRole('button', { name: 'orders.removeDiscount' })).toBeInTheDocument();
  });

  it('advances to confirm and applies a below-threshold discount', async () => {
    mockThreshold = 1000; // 10% of 100 = $10 discount, well below → no type-to-confirm
    renderWithProviders(<DiscountModal {...defaultProps} />);
    setValue('10');
    fireEvent.click(continueBtn());

    const confirm = screen.getByRole('button', {
      name: 'discounts.confirmCta',
    }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);

    await vi.waitFor(() => expect(mockApplyDiscount.mutateAsync).toHaveBeenCalledTimes(1));
    const arg = mockApplyDiscount.mutateAsync.mock.calls[0]![0] as {
      discount_type?: string;
      discount_value?: number;
    };
    expect(arg.discount_type).toBe('percentage');
    expect(arg.discount_value).toBe(10);
  });

  it('requires the type-to-confirm phrase above the threshold', () => {
    mockThreshold = 5; // $10 discount ≥ $5 threshold → type-to-confirm required
    renderWithProviders(<DiscountModal {...defaultProps} />);
    setValue('10');
    fireEvent.click(continueBtn());

    // DISCOUNT <amount> phrase gate; confirm stays disabled until it matches.
    const confirm = screen.getByRole('button', {
      name: 'discounts.confirmCta',
    }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
  });
});
