'use client';

import { useTranslation } from '@cafe-idare/i18n';
import { Trash2 } from 'lucide-react';
import type { WasteMetrics } from '@/lib/report-pdf-export';

interface WasteSectionProps {
  wasteMetrics: WasteMetrics;
  formatPrice: (amount: number) => string;
}

export function WasteSection({ wasteMetrics, formatPrice }: WasteSectionProps) {
  const { t } = useTranslation('staff');

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-6 mb-4 sm:mb-8">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <Trash2 className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
        <h2 className="text-base sm:text-lg font-semibold">{t('reports.wasteSummary')}</h2>
      </div>

      {wasteMetrics.totalItems === 0 ? (
        <p className="text-gray-500 text-center py-4 text-sm">{t('reports.noWaste')}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
            <div className="bg-red-50 rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-red-700">{t('reports.totalWasteCost')}</p>
              <p className="text-lg sm:text-2xl font-bold text-red-700">
                {formatPrice(wasteMetrics.totalCost)}
              </p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-orange-700">{t('reports.wasteEntries')}</p>
              <p className="text-lg sm:text-2xl font-bold text-orange-700">
                {wasteMetrics.totalItems}
              </p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 sm:p-4 col-span-2 sm:col-span-1">
              <p className="text-xs sm:text-sm text-amber-700">{t('reports.avgCostEntry')}</p>
              <p className="text-lg sm:text-2xl font-bold text-amber-700">
                {formatPrice(
                  wasteMetrics.totalItems > 0
                    ? wasteMetrics.totalCost / wasteMetrics.totalItems
                    : 0,
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Waste by Reason */}
            {wasteMetrics.byReason.length > 0 && (
              <div>
                <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-3">
                  {t('reports.wasteByReason')}
                </h3>
                <div className="space-y-2">
                  {wasteMetrics.byReason.map((item) => {
                    const percentage =
                      wasteMetrics.totalCost > 0 ? (item.cost / wasteMetrics.totalCost) * 100 : 0;
                    const reasonLabel = item.reason
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (c: string) => c.toUpperCase());
                    return (
                      <div key={item.reason} className="flex items-center gap-3">
                        <span className="text-xs sm:text-sm text-gray-600 w-28 sm:w-36 truncate">
                          {reasonLabel}
                        </span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-red-400 h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-xs sm:text-sm font-medium text-gray-900 w-20 text-right">
                          {formatPrice(item.cost)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top Wasted Items */}
            {wasteMetrics.topItems.length > 0 && (
              <div>
                <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-3">
                  {t('reports.topWastedItems')}
                </h3>
                <div className="space-y-2">
                  {wasteMetrics.topItems.map((item, index) => (
                    <div key={item.name} className="flex justify-between items-center">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs sm:text-sm font-medium text-gray-500">
                          #{index + 1}
                        </span>
                        <span className="truncate text-xs sm:text-sm">{item.name}</span>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className="font-medium text-xs sm:text-sm">
                          {item.quantity} {item.unit}
                        </p>
                        <p className="text-xs text-red-600">{formatPrice(item.cost)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
