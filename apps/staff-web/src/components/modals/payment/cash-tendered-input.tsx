'use client';

import type { useTranslation } from '@gustri/i18n';
import { NumberInput } from '@gustri/ui-web';

type TFunc = ReturnType<typeof useTranslation>['t'];

interface CashTenderedInputProps {
  /** Final amount the cashier must collect (payment amount + tip). */
  totalToCollect: number;
  cashReceived: string;
  onCashReceivedChange: (value: string) => void;
  currencySymbol: string;
  formatPrice: (n: number) => string;
  t: TFunc;
}

// Convenient "rounded note" amounts a cashier is likely to be handed. We offer
// the exact total plus the next round figures above it (next 5 / 10 / 20 / 50 /
// 100), so the common cases are one tap instead of typing.
export function quickAmounts(total: number): number[] {
  if (total <= 0) return [];
  const steps = [5, 10, 20, 50, 100];
  const roundUps = steps.map((step) => Math.ceil(total / step) * step).filter((v) => v > total);
  return [total, ...Array.from(new Set(roundUps))].slice(0, 4);
}

export function CashTenderedInput({
  totalToCollect,
  cashReceived,
  onCashReceivedChange,
  currencySymbol,
  formatPrice,
  t,
}: CashTenderedInputProps) {
  const received = parseFloat(cashReceived) || 0;
  const change = received - totalToCollect;
  const hasChange = received > 0 && change >= 0;
  const amounts = quickAmounts(totalToCollect);

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {t('payment.cashReceived')}
      </label>
      <NumberInput
        value={cashReceived}
        onChange={onCashReceivedChange}
        min={0}
        step={0.01}
        placeholder="0.00"
        prefix={currencySymbol}
      />

      {amounts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {amounts.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => onCashReceivedChange(amount.toFixed(2))}
              className="flex-1 min-w-[4.5rem] rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {formatPrice(amount)}
            </button>
          ))}
        </div>
      )}

      {received > 0 && (
        <div
          className={`mt-3 flex items-center justify-between rounded-lg px-3 py-2 ${
            hasChange ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
          }`}
        >
          <span className="text-sm font-medium">{t('payment.changeDue')}</span>
          <span className="text-lg font-bold">{formatPrice(hasChange ? change : 0)}</span>
        </div>
      )}
    </div>
  );
}
