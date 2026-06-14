import type { useTranslation } from '@gustri/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CashTenderedInput, quickAmounts } from '@/components/modals/payment/cash-tendered-input';

// The component's `t` prop is i18next's branded TFunction; a bare
// (key) => key stub isn't assignable, so cast through the real type.
type TFunc = ReturnType<typeof useTranslation>['t'];

describe('quickAmounts', () => {
  it('returns no chips for a non-positive total', () => {
    expect(quickAmounts(0)).toEqual([]);
    expect(quickAmounts(-5)).toEqual([]);
  });

  it('always leads with the exact total', () => {
    expect(quickAmounts(550)[0]).toBe(550);
    expect(quickAmounts(12.5)[0]).toBe(12.5);
  });

  it('offers the exact total plus the next round figures above it', () => {
    // 550 → next 20 = 560, next 100 = 600 (next 5/10/50 all land on 550 and are
    // filtered as not strictly greater).
    expect(quickAmounts(550)).toEqual([550, 560, 600]);
  });

  it('drops round-ups that equal the total (a total already on a denomination)', () => {
    // 500 sits on every step, so there is nothing strictly greater to offer.
    expect(quickAmounts(500)).toEqual([500]);
  });

  it('never returns more than four chips and keeps them ascending', () => {
    const chips = quickAmounts(12.5);
    expect(chips.length).toBeLessThanOrEqual(4);
    expect(chips[0]).toBe(12.5);
    expect([...chips]).toEqual([...chips].sort((a, b) => a - b));
  });
});

describe('CashTenderedInput change-due', () => {
  const baseProps = {
    currencySymbol: '$',
    formatPrice: (n: number) => n.toFixed(2),
    t: ((key: string) => key) as unknown as TFunc,
  };

  it('shows the change owed once cash received covers the total', () => {
    render(
      <CashTenderedInput
        {...baseProps}
        totalToCollect={550}
        cashReceived="600"
        onCashReceivedChange={() => {}}
      />,
    );
    // 600 - 550 = 50.00 owed back to the customer.
    expect(screen.getByText('payment.changeDue')).toBeDefined();
    expect(screen.getByText('50.00')).toBeDefined();
  });

  it('shows zero change when the cash received is short of the total', () => {
    render(
      <CashTenderedInput
        {...baseProps}
        totalToCollect={550}
        cashReceived="500"
        onCashReceivedChange={() => {}}
      />,
    );
    // Short payment must never imply negative change — it clamps to 0.00.
    expect(screen.getByText('0.00')).toBeDefined();
  });

  it('hides the change row entirely until cash is entered', () => {
    render(
      <CashTenderedInput
        {...baseProps}
        totalToCollect={550}
        cashReceived=""
        onCashReceivedChange={() => {}}
      />,
    );
    expect(screen.queryByText('payment.changeDue')).toBeNull();
  });
});
