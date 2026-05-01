'use client';

import type { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
import { Check } from 'lucide-react';

type TFunc = ReturnType<typeof useTranslation>['t'];

interface PaymentFooterProps {
  paymentAmount: number;
  remainingBalance: number | undefined;
  orderTotal: number;
  tipAmount: string;
  tipsEnabled: boolean;
  isFullyPaid: boolean;
  isZeroTotal: boolean;
  loading: boolean;
  canPay: boolean;
  onCancel: () => void;
  onPay: () => void;
  onCompleteOrder: () => void;
  formatPrice: (n: number) => string;
  t: TFunc;
}

export function PaymentFooter({
  paymentAmount,
  remainingBalance,
  orderTotal,
  tipAmount,
  tipsEnabled,
  isFullyPaid,
  isZeroTotal,
  loading,
  canPay,
  onCancel,
  onPay,
  onCompleteOrder,
  formatPrice,
  t,
}: PaymentFooterProps) {
  const tipNum = parseFloat(tipAmount) || 0;
  const balance = remainingBalance ?? orderTotal;

  return (
    <div className="border-t p-6">
      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">{t('payment.paymentType')}</span>
          <span className="font-medium">{formatPrice(paymentAmount)}</span>
        </div>
        {tipsEnabled && tipNum > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">{t('orders.tip')}</span>
            <span className="font-medium text-green-600">{formatPrice(tipNum)}</span>
          </div>
        )}
        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-lg font-medium">{t('payment.totalToCollect')}</span>
          <span
            className={`text-2xl font-bold ${isFullyPaid ? 'text-green-600' : 'text-blue-600'}`}
          >
            {formatPrice(paymentAmount + tipNum)}
          </span>
        </div>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} disabled={loading} className="flex-1">
          {t('cancel', { ns: 'common' })}
        </Button>
        {isFullyPaid || isZeroTotal ? (
          <Button
            onClick={onCompleteOrder}
            disabled={loading || !canPay}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <Check className="h-4 w-4 mr-2" />
            {loading ? t('payment.completing') : t('payment.completeOrder')}
          </Button>
        ) : (
          <Button
            onClick={onPay}
            disabled={paymentAmount <= 0 || paymentAmount > balance + 0.01 || loading || !canPay}
            className="flex-1"
          >
            {loading ? t('payment.processing') : t('payment.processPaymentBtn')}
          </Button>
        )}
      </div>
    </div>
  );
}
