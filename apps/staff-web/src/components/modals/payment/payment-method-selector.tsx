'use client';

import type { useTranslation } from '@gustri/i18n';
import { Banknote, CreditCard, Smartphone } from 'lucide-react';

type TFunc = ReturnType<typeof useTranslation>['t'];

type PaymentMethod = 'cash' | 'card' | 'digital';

interface PaymentMethodSelectorProps {
  paymentMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  t: TFunc;
}

const METHOD_ICONS: Record<PaymentMethod, typeof Banknote> = {
  cash: Banknote,
  card: CreditCard,
  digital: Smartphone,
};

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
      <div className="grid grid-cols-3 gap-2">
        {(['cash', 'card', 'digital'] as const).map((method) => {
          const Icon = METHOD_ICONS[method];
          return (
            <button
              key={method}
              type="button"
              onClick={() => onMethodChange(method)}
              className={`flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
                paymentMethod === method
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-5 w-5" />
              {t(method, { ns: 'common' })}
            </button>
          );
        })}
      </div>
    </div>
  );
}
