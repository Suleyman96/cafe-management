'use client';

import { useTranslation } from '@gustri/i18n';
import type { useReportMetrics } from '@/components/reports/use-report-metrics';

type ReportMetrics = ReturnType<typeof useReportMetrics>['metrics'];

interface OrderStatusSectionProps {
  metrics: ReportMetrics;
}

export function OrderStatusSection({ metrics }: OrderStatusSectionProps) {
  const { t } = useTranslation('staff');

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-6 mb-4 sm:mb-8">
      <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
        {t('reports.orderStatusSummary')}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="text-center">
          <p className="text-xl sm:text-3xl font-bold text-green-600">{metrics.completedOrders}</p>
          <p className="text-xs sm:text-sm text-gray-600">{t('completed', { ns: 'common' })}</p>
        </div>
        <div className="text-center">
          <p className="text-xl sm:text-3xl font-bold text-red-600">{metrics.cancelledOrders}</p>
          <p className="text-xs sm:text-sm text-gray-600">{t('orders.cancelled')}</p>
        </div>
        <div className="text-center">
          <p className="text-xl sm:text-3xl font-bold text-blue-600">{metrics.totalItems}</p>
          <p className="text-xs sm:text-sm text-gray-600">{t('reports.itemsSold')}</p>
        </div>
        <div className="text-center">
          <p className="text-xl sm:text-3xl font-bold text-purple-600">
            {metrics.totalOrders > 0 ? (metrics.totalItems / metrics.totalOrders).toFixed(1) : '0'}
          </p>
          <p className="text-xs sm:text-sm text-gray-600">{t('reports.itemsPerOrder')}</p>
        </div>
      </div>
    </div>
  );
}
