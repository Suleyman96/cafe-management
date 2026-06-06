'use client';

import type { OrderPayment } from '@gustri/database/types';
import { useDateFormatter, useTranslation } from '@gustri/i18n';
import { LoadingSpinner } from '@gustri/ui-web';
import { CreditCard } from 'lucide-react';

interface StaffRecentPaymentsProps {
  recentPayments: OrderPayment[] | undefined;
  paymentsLoading: boolean;
  formatPrice: (amount: number) => string;
}

export function StaffRecentPayments({
  recentPayments,
  paymentsLoading,
  formatPrice,
}: StaffRecentPaymentsProps) {
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const dfDate = useDateFormatter();

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 sm:px-6 py-3 border-b">
        <h2 className="text-lg font-semibold">{t('staffMgmt.recentPayments')}</h2>
      </div>
      {paymentsLoading ? (
        <div className="p-6 flex justify-center">
          <LoadingSpinner />
        </div>
      ) : !recentPayments || recentPayments.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-500">{t('staffMgmt.noPayments')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('orders.order')}
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  {tCommon('amount')}
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('expenses.paymentMethod')}
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  {tCommon('date')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900">
                    #{payment.order_id?.slice(0, 6) || '-'}
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-medium">
                    {formatPrice(payment.amount)}
                  </td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                      <CreditCard className="h-3 w-3" />
                      {payment.payment_method || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-right text-gray-500">
                    {dfDate.format(new Date(payment.created_at))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
