'use client';

import type { useTranslation } from '@gustri/i18n';
import { NumberInput } from '@gustri/ui-web';

type TFunc = ReturnType<typeof useTranslation>['t'];

interface TipInputProps {
  tipAmount: string;
  onTipChange: (value: string) => void;
  /** Amount being paid — quick-tip percentages are computed off this. */
  baseAmount: number;
  currencySymbol: string;
  formatPrice: (n: number) => string;
  t: TFunc;
}

const TIP_PERCENTAGES = [10, 15, 20] as const;

export function TipInput({
  tipAmount,
  onTipChange,
  baseAmount,
  currencySymbol,
  formatPrice,
  t,
}: TipInputProps) {
  const tipNum = parseFloat(tipAmount) || 0;

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">{t('payment.addTip')}</label>

      {baseAmount > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {TIP_PERCENTAGES.map((pct) => {
            const value = (baseAmount * pct) / 100;
            const active = Math.abs(value - tipNum) < 0.005 && tipNum > 0;
            return (
              <button
                key={pct}
                type="button"
                onClick={() => onTipChange(value.toFixed(2))}
                className={`flex-1 min-w-[3.5rem] rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {pct}%
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onTipChange('')}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50"
          >
            {t('clear', { ns: 'common' })}
          </button>
        </div>
      )}

      <NumberInput
        value={tipAmount}
        onChange={onTipChange}
        min={0}
        step={0.01}
        placeholder="0.00"
        prefix={currencySymbol}
      />
      {tipNum > 0 && (
        <div className="mt-2 text-sm text-green-600">
          {t('orders.tip')}: {formatPrice(tipNum)}
        </div>
      )}
    </div>
  );
}
