'use client';

import { calculateChange, getDenominations } from '@gustri/core';
import { useState } from 'react';
import { NumberInput } from '@/components/ui/number-input';

interface CashChangeCalculatorProps {
  paymentAmount: number;
  currencySymbol: string;
  currencyCode: string;
  formatPrice: (amount: number) => string;
  t: (key: string, opts?: any) => string;
}

export function CashChangeCalculator({
  paymentAmount,
  currencySymbol,
  currencyCode,
  formatPrice,
  t,
}: CashChangeCalculatorProps) {
  const [amountTendered, setAmountTendered] = useState('');
  const tendered = parseFloat(amountTendered) || 0;
  const change = calculateChange(tendered, paymentAmount);
  const denominations = getDenominations(currencyCode);

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {t('payment.amountTendered')}
      </label>
      <NumberInput
        value={amountTendered}
        onChange={setAmountTendered}
        min={0}
        step={0.01}
        placeholder="0.00"
        prefix={currencySymbol}
      />

      {/* Quick denomination buttons */}
      <div className="flex flex-wrap gap-2 mt-2">
        {denominations.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setAmountTendered(d.toString())}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            {currencySymbol}
            {d}
          </button>
        ))}
      </div>

      {/* Change display */}
      {tendered > 0 && (
        <div className="mt-3 p-3 rounded-lg bg-green-50 border border-green-200">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-green-700">{t('payment.changeDue')}</span>
            <span className="text-lg font-bold text-green-700">{formatPrice(change)}</span>
          </div>
          {tendered < paymentAmount && (
            <p className="text-xs text-red-600 mt-1">{t('payment.insufficientAmount')}</p>
          )}
        </div>
      )}
    </div>
  );
}
