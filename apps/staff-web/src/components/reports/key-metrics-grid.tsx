'use client';

import { useTranslation } from '@gustri/i18n';
import { ChefHat, DollarSign, ShoppingBag, TrendingUp } from 'lucide-react';
import type { useReportMetrics } from '@/components/reports/use-report-metrics';

type ReportMetrics = ReturnType<typeof useReportMetrics>['metrics'];

interface KeyMetricsGridProps {
  metrics: ReportMetrics;
  formatPrice: (amount: number) => string;
}

export function KeyMetricsGrid({ metrics, formatPrice }: KeyMetricsGridProps) {
  const { t } = useTranslation('staff');

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-8">
      <div className="bg-white rounded-lg shadow p-3 sm:p-6">
        <div className="flex items-center justify-between mb-1 sm:mb-2">
          <p className="text-xs sm:text-sm text-gray-600">{t('reports.totalRevenue')}</p>
          <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
        </div>
        <p className="text-lg sm:text-2xl font-bold">{formatPrice(metrics.totalRevenue)}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-3 sm:p-6">
        <div className="flex items-center justify-between mb-1 sm:mb-2">
          <p className="text-xs sm:text-sm text-gray-600">{t('reports.totalOrders')}</p>
          <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
        </div>
        <p className="text-lg sm:text-2xl font-bold">{metrics.totalOrders}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-3 sm:p-6">
        <div className="flex items-center justify-between mb-1 sm:mb-2">
          <p className="text-xs sm:text-sm text-gray-600">{t('reports.avgOrderShort')}</p>
          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
        </div>
        <p className="text-lg sm:text-2xl font-bold">{formatPrice(metrics.averageOrderValue)}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-3 sm:p-6">
        <div className="flex items-center justify-between mb-1 sm:mb-2">
          <p className="text-xs sm:text-sm text-gray-600">{t('reports.completion')}</p>
          <ChefHat className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
        </div>
        <p className="text-lg sm:text-2xl font-bold">
          {metrics.totalOrders > 0
            ? Math.round((metrics.completedOrders / metrics.totalOrders) * 100)
            : 0}
          %
        </p>
      </div>
    </div>
  );
}
