'use client';

import { formatDateTime } from '@gustri/core';
import { useLocale, useTranslation } from '@gustri/i18n';
import type { Payment } from './use-order-detail';

interface OrderDetailPaymentsProps {
  payments: Payment[];
  paid: number;
  remaining: number;
  formatPrice: (amount: number) => string;
}

export function OrderDetailPayments({
  payments,
  paid,
  remaining,
  formatPrice,
}: OrderDetailPaymentsProps) {
  const { t } = useTranslation('staff');
  const locale = useLocale();

  return (
    <div className="border rounded-lg mb-6">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">{t('orders.paymentHistory')}</h2>
      </div>
      <div className="divide-y">
        {payments.map((payment: Payment, index: number) => {
          const paymentTypeLabel =
            payment.payment_type === 'full'
              ? t('payment.fullPayment')
              : payment.payment_type === 'specific_items'
                ? t('payment.specificItems')
                : t('payment.partialAmount');

          return (
            <div key={payment.id} className="px-4 py-3">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{formatPrice(payment.amount)}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                      {paymentTypeLabel}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 capitalize">
                      {payment.payment_method}
                    </span>
                  </div>
                  {Number(payment.tip_amount) > 0 && (
                    <p className="text-sm text-green-600 mt-0.5">
                      + {formatPrice(payment.tip_amount)} {t('orders.tip')}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {payment.received_by_staff?.full_name || t('unknown', { ns: 'common' })}{' '}
                    &middot; {formatDateTime(payment.created_at, locale)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-xs text-gray-400">#{index + 1}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t px-4 py-3">
        <div className="flex justify-between items-center">
          <span className="font-semibold">{t('orders.totalPaid')}</span>
          <span className="font-semibold text-green-600">{formatPrice(paid)}</span>
        </div>
        {remaining > 0 && (
          <div className="flex justify-between items-center mt-2">
            <span className="font-semibold">{t('orders.remaining')}</span>
            <span className="font-semibold text-orange-600">{formatPrice(remaining)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
