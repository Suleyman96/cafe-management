'use client';

import type { useTranslation } from '@gustri/i18n';
import { NumberInput } from '@gustri/ui-web';

type TFunc = ReturnType<typeof useTranslation>['t'];

interface TipInputProps {
  tipAmount: string;
  onTipChange: (value: string) => void;
  currencySymbol: string;
  formatPrice: (n: number) => string;
  t: TFunc;
}

export function TipInput({
  tipAmount,
  onTipChange,
  currencySymbol,
  formatPrice,
  t,
}: TipInputProps) {
  const tipNum = parseFloat(tipAmount) || 0;

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">{t('payment.addTip')}</label>
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
