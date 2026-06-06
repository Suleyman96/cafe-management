'use client';

import { useTranslation } from '@gustri/i18n';
import { Package, Truck, Users } from 'lucide-react';
import type { useReportMetrics } from '@/components/reports/use-report-metrics';

type ReportMetrics = ReturnType<typeof useReportMetrics>['metrics'];

interface OrderBreakdownSectionProps {
  metrics: ReportMetrics;
  formatPrice: (amount: number) => string;
}

export function OrderBreakdownSection({ metrics, formatPrice }: OrderBreakdownSectionProps) {
  const { t } = useTranslation('staff');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6 mb-4 sm:mb-8">
      <div className="bg-white rounded-lg shadow p-3 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
          {t('reports.orderTypes')}
        </h2>
        <div className="space-y-2 sm:space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Users className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
              <span className="text-sm sm:text-base">{t('reports.dineIn')}</span>
            </div>
            <span className="font-medium text-sm sm:text-base">{metrics.dineInOrders}</span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Package className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
              <span className="text-sm sm:text-base">{t('reports.takeout')}</span>
            </div>
            <span className="font-medium text-sm sm:text-base">{metrics.takeoutOrders}</span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Truck className="h-3 w-3 sm:h-4 sm:w-4 text-orange-600" />
              <span className="text-sm sm:text-base">{t('reports.delivery')}</span>
            </div>
            <span className="font-medium text-sm sm:text-base">{metrics.deliveryOrders}</span>
          </div>
        </div>
        {metrics.totalOrders > 0 && (
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
            <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-gray-100">
              <div
                className="bg-blue-600 h-2"
                style={{ width: `${(metrics.dineInOrders / metrics.totalOrders) * 100}%` }}
              />
              <div
                className="bg-green-500 h-2"
                style={{ width: `${(metrics.takeoutOrders / metrics.totalOrders) * 100}%` }}
              />
              <div
                className="bg-orange-500 h-2"
                style={{ width: `${(metrics.deliveryOrders / metrics.totalOrders) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-600 mt-2 flex-wrap gap-1">
              <span>
                {t('reports.dineIn')}:{' '}
                {Math.round((metrics.dineInOrders / metrics.totalOrders) * 100)}%
              </span>
              <span>
                {t('reports.takeout')}:{' '}
                {Math.round((metrics.takeoutOrders / metrics.totalOrders) * 100)}%
              </span>
              <span>
                {t('reports.delivery')}:{' '}
                {Math.round((metrics.deliveryOrders / metrics.totalOrders) * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Sold Items */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-6">
        <div className="flex justify-between items-center mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-semibold">{t('reports.soldItems')}</h2>
          <span className="text-xs sm:text-sm text-gray-500">
            {t('reports.itemsCount', { count: metrics.soldItems.length })}
          </span>
        </div>
        <div className="space-y-2 sm:space-y-3 max-h-48 sm:max-h-80 overflow-y-auto">
          {metrics.soldItems.map((item, index) => (
            <div key={item.name} className="flex justify-between items-center">
              <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
                <span className="text-xs sm:text-sm font-medium text-gray-500">#{index + 1}</span>
                <span className="truncate text-xs sm:text-sm">{item.name}</span>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <p className="font-medium text-xs sm:text-sm">
                  {t('reports.soldCount', { count: item.count })}
                </p>
                <p className="text-xs text-gray-600">{formatPrice(item.revenue)}</p>
              </div>
            </div>
          ))}
          {metrics.soldItems.length === 0 && (
            <p className="text-gray-500 text-center py-4 text-sm">{t('reports.noItemsSold')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
