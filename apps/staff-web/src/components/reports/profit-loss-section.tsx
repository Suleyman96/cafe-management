'use client';

import { useTranslation } from '@gustri/i18n';
import { DollarSign, Receipt, TrendingUp } from 'lucide-react';
import type { useReportMetrics } from '@/components/reports/use-report-metrics';

type ReportMetricsResult = ReturnType<typeof useReportMetrics>;
type ReportMetrics = ReportMetricsResult['metrics'];
type ProfitMetrics = ReportMetricsResult['profitMetrics'];

interface ProfitLossSectionProps {
  metrics: ReportMetrics;
  profitMetrics: ProfitMetrics;
  formatPrice: (amount: number) => string;
}

export function ProfitLossSection({ metrics, profitMetrics, formatPrice }: ProfitLossSectionProps) {
  const { t } = useTranslation('staff');

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-6 mb-4 sm:mb-8">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
        <h2 className="text-base sm:text-lg font-semibold">{t('reports.profitLoss')}</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <div className="bg-green-50 rounded-lg p-3 sm:p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs sm:text-sm text-green-700">{t('reports.revenue')}</p>
            <DollarSign className="h-4 w-4 text-green-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-green-700">
            {formatPrice(metrics.totalRevenue)}
          </p>
        </div>

        <div className="bg-orange-50 rounded-lg p-3 sm:p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs sm:text-sm text-orange-700">{t('reports.totalDiscounts')}</p>
            <Receipt className="h-4 w-4 text-orange-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-orange-700">
            {formatPrice(metrics.totalDiscounts)}
          </p>
        </div>

        <div className="bg-red-50 rounded-lg p-3 sm:p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs sm:text-sm text-red-700">{t('reports.expenses')}</p>
            <Receipt className="h-4 w-4 text-red-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-red-700">
            {formatPrice(profitMetrics.totalExpenses)}
          </p>
        </div>

        <div
          className={`rounded-lg p-3 sm:p-4 ${profitMetrics.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}
        >
          <div className="flex items-center justify-between mb-1">
            <p
              className={`text-xs sm:text-sm ${profitMetrics.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}
            >
              {t('reports.netProfit')}
            </p>
            <TrendingUp
              className={`h-4 w-4 ${profitMetrics.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}
            />
          </div>
          <p
            className={`text-lg sm:text-2xl font-bold ${profitMetrics.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}
          >
            {profitMetrics.netProfit < 0 ? '-' : ''}
            {formatPrice(Math.abs(profitMetrics.netProfit))}
          </p>
          {metrics.totalRevenue > 0 && (
            <p
              className={`text-xs mt-1 ${profitMetrics.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {profitMetrics.profitMargin.toFixed(1)}% {t('reports.margin')}
            </p>
          )}
        </div>
      </div>

      {profitMetrics.byCategory.length > 0 && (
        <div>
          <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-3">
            {t('reports.expenseBreakdown')}
          </h3>
          <div className="space-y-2">
            {profitMetrics.byCategory.map((cat) => {
              const percentage =
                profitMetrics.totalExpenses > 0
                  ? (cat.total / profitMetrics.totalExpenses) * 100
                  : 0;
              return (
                <div key={cat.name} className="flex items-center gap-3">
                  <span className="text-xs sm:text-sm text-gray-600 w-24 sm:w-28 truncate">
                    {cat.name}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-red-400 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-gray-900 w-20 text-right">
                    {formatPrice(cat.total)}
                  </span>
                  <span className="text-xs text-gray-400 w-8 text-right">
                    {percentage.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {profitMetrics.byCategory.length === 0 && (
        <p className="text-gray-500 text-center py-4 text-sm">{t('reports.noExpenses')}</p>
      )}
    </div>
  );
}
