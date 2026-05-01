'use client';

import type { useTranslation } from '@gustri/i18n';

type TFunc = ReturnType<typeof useTranslation>['t'];

type PaymentMethod = 'cash' | 'card' | 'digital';

interface PaymentMethodSelectorProps {
  paymentMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  t: TFunc;
}

export function PaymentMethodSelector({
  paymentMethod,
  onMethodChange,
  t,
}: PaymentMethodSelectorProps) {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {t('payment.paymentMethod')}
      </label>
      <div className="flex gap-2">
        {(['cash', 'card', 'digital'] as const).map((method) => (
          <button
            key={method}
            type="button"
            onClick={() => onMethodChange(method)}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              paymentMethod === method
                ? 'bg-blue-100 border-blue-500 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t(method, { ns: 'common' })}
          </button>
        ))}
      </div>
    </div>
  );
}
