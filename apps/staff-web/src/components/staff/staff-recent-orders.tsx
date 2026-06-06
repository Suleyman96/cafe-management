'use client';

import type { OrderStatus } from '@gustri/database/schemas';
import type { OrderWithDetails } from '@gustri/database/types';
import { useDateFormatter, useTranslation } from '@gustri/i18n';
import { LoadingSpinner, ORDER_STATUS_BADGES } from '@gustri/ui-web';

interface StaffRecentOrdersProps {
  recentOrders: OrderWithDetails[];
  ordersLoading: boolean;
  formatPrice: (amount: number) => string;
}

function getStatusBadge(status: string) {
  const config = ORDER_STATUS_BADGES[status as OrderStatus];
  return config ? `${config.bg} ${config.text}` : 'bg-gray-100 text-gray-800';
}

export function StaffRecentOrders({
  recentOrders,
  ordersLoading,
  formatPrice,
}: StaffRecentOrdersProps) {
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const dfDate = useDateFormatter();

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 sm:px-6 py-3 border-b">
        <h2 className="text-lg font-semibold">{t('staffMgmt.recentOrders')}</h2>
      </div>
      {ordersLoading ? (
        <div className="p-6 flex justify-center">
          <LoadingSpinner />
        </div>
      ) : recentOrders.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-500">{t('staffMgmt.noOrders')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('staffMgmt.orderNumber')}
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('staffMgmt.table')}
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  {tCommon('status')}
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('tables.items')}
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  {tCommon('total')}
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  {tCommon('date')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentOrders.map((order) => {
                const orderTotal =
                  order.order_items?.reduce(
                    (sum, item) => sum + item.quantity * item.item_price,
                    0,
                  ) || 0;
                const itemCount =
                  order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">
                      #{order.order_number || order.id.slice(0, 6)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {order.table?.table_number
                        ? t('staffMgmt.tableNumber', { number: order.table.table_number })
                        : '-'}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadge(order.status)}`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">{itemCount}</td>
                    <td className="px-4 py-2 text-sm text-right font-medium">
                      {formatPrice(orderTotal)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-500">
                      {dfDate.format(new Date(order.created_at))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
