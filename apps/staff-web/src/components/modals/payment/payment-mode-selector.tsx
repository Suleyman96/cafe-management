'use client';

import { CheckCircle, DollarSign } from 'lucide-react';

type PaymentMode = 'full' | 'partial' | 'items';

interface PaymentModeSelectorProps {
  paymentMode: PaymentMode;
  onModeChange: (mode: PaymentMode) => void;
  remainingBalance: number | undefined;
  orderTotal: number;
  formatPrice: (amount: number) => string;
  t: (key: string, opts?: any) => string;
}

export function PaymentModeSelector({
  paymentMode,
  onModeChange,
  remainingBalance,
  orderTotal,
  formatPrice,
  t,
}: PaymentModeSelectorProps) {
  const modes = [
    {
      value: 'full' as const,
      icon: DollarSign,
      label: t('payment.fullPayment'),
      subtitle: formatPrice(remainingBalance ?? orderTotal),
    },
    {
      value: 'partial' as const,
      icon: DollarSign,
      label: t('payment.partialAmount'),
      subtitle: t('payment.customAmount'),
    },
    {
      value: 'items' as const,
      icon: CheckCircle,
      label: t('payment.specificItems'),
      subtitle: t('payment.selectItems'),
    },
  ];

  return (
    <div className="space-y-3 mb-6">
      <label className="block text-sm font-medium text-gray-700">{t('payment.paymentType')}</label>
      <div className="grid grid-cols-3 gap-3">
        {modes.map(({ value, icon: Icon, label, subtitle }) => (
          <button
            key={value}
            onClick={() => onModeChange(value)}
            className={`p-3 border rounded-lg text-center transition-colors ${
              paymentMode === value
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Icon className="h-5 w-5 mx-auto mb-1" />
            <div className="text-sm font-medium">{label}</div>
            <div className="text-xs text-gray-600">{subtitle}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
