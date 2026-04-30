'use client';

import { NumberInput } from '@gustri/ui-web';

interface PartialPaymentFormProps {
  partialAmount: string;
  onAmountChange: (value: string) => void;
  remainingBalance: number | undefined;
  orderTotal: number;
  currencySymbol: string;
  formatPrice: (amount: number) => string;
  t: (key: string, opts?: Record<string, string | number>) => string;
}

export function PartialPaymentForm({
  partialAmount,
  onAmountChange,
  remainingBalance,
  orderTotal,
  currencySymbol,
  formatPrice,
  t,
}: PartialPaymentFormProps) {
  const maxAmount = remainingBalance ?? orderTotal;
  const exceedsBalance = (parseFloat(partialAmount) || 0) > maxAmount;

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {t('payment.amountToPay')}
      </label>
      <NumberInput
        value={partialAmount}
        onChange={onAmountChange}
        min={0}
        max={maxAmount}
        step={0.01}
        placeholder="0.00"
        prefix={currencySymbol}
      />
      {exceedsBalance && (
        <p className="text-sm text-red-600 mt-1">
          {t('payment.exceedsBalance', {
            amount: formatPrice(parseFloat(partialAmount) || 0),
            balance: formatPrice(maxAmount),
          })}
        </p>
      )}
    </div>
  );
}
