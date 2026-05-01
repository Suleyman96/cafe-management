'use client';

import type { Database } from '@gustri/database';
import type { useTranslation } from '@gustri/i18n';

type Order = Database['public']['Tables']['orders']['Row'];

type TFunc = ReturnType<typeof useTranslation>['t'];

interface OrderSummaryProps {
  order: Order;
  orderSubtotal: number;
  orderTax: number;
  orderTotal: number;
  remainingBalance: number | undefined;
  isFullyPaid: boolean;
  formatPrice: (n: number) => string;
  t: TFunc;
}

export function OrderSummary({
  order,
  orderSubtotal,
  orderTax,
  orderTotal,
  remainingBalance,
  isFullyPaid,
  formatPrice,
  t,
}: OrderSummaryProps) {
  return (
    <div className="mb-6">
      {orderTax > 0 && (
        <>
          <div className="flex justify-between items-center text-sm text-gray-600 mb-1">
            <span>{t('subtotal', { ns: 'common' })}</span>
            <span>{formatPrice(orderSubtotal)}</span>
          </div>
          {(order.discount_amount ?? 0) > 0 && (
            <div className="flex justify-between items-center text-sm text-red-600 mb-1">
              <span>
                {t('orders.discount')} (
                {order.discount_type === 'percentage'
                  ? `${order.discount_value}%`
                  : formatPrice(order.discount_value ?? 0)}
                )
              </span>
              <span>-{formatPrice(order.discount_amount ?? 0)}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
            <span>{t('orders.tax')}</span>
            <span>{formatPrice(orderTax)}</span>
          </div>
        </>
      )}
      <div
        className={`flex justify-between items-center text-sm font-medium mb-2 ${orderTax > 0 ? 'pt-2 border-t' : ''}`}
      >
        <span>{t('payment.orderTotal')}</span>
        <span>{formatPrice(orderTotal)}</span>
      </div>
      {remainingBalance !== undefined && remainingBalance < orderTotal && (
        <>
          <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
            <span>{t('payment.alreadyPaid')}</span>
            <span className="font-medium text-green-600">
              {formatPrice(orderTotal - remainingBalance)}
            </span>
          </div>
          <div className="flex justify-between items-center font-medium">
            <span>{t('payment.remainingBalance')}</span>
            <span className={isFullyPaid ? 'text-green-600' : 'text-orange-600'}>
              {formatPrice(remainingBalance)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
