import { useState } from 'react';

export type PaymentMode = 'full' | 'partial' | 'items';

interface UsePaymentModeArgs {
  /** Remaining balance — the amount charged in `full` mode. */
  balance: number;
  /** Selected items subtotal + proportional tax — the amount charged in `items` mode. */
  selectedItemsTotal: number;
}

export interface UsePaymentModeResult {
  mode: PaymentMode;
  setMode: (mode: PaymentMode) => void;
  /** Free-text input backing `partial` mode. */
  partialAmount: string;
  setPartialAmount: (value: string) => void;
  /** Resolve the amount to charge for the current mode. EXACT mode-dispatch. */
  computeAmount: () => number;
}

/**
 * Payment-mode selection state + the amount-dispatch logic. `computeAmount`
 * decides which amount to charge given the active mode, preserving the exact
 * mode-dispatch behavior of the original screen.
 */
export function usePaymentMode({
  balance,
  selectedItemsTotal,
}: UsePaymentModeArgs): UsePaymentModeResult {
  const [mode, setMode] = useState<PaymentMode>('full');
  const [partialAmount, setPartialAmount] = useState('');

  const computeAmount = (): number => {
    switch (mode) {
      case 'full':
        return balance;
      case 'partial':
        return parseFloat(partialAmount) || 0;
      case 'items':
        return selectedItemsTotal;
    }
  };

  return { mode, setMode, partialAmount, setPartialAmount, computeAmount };
}
