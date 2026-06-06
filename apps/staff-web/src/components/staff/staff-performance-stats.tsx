'use client';

import { useTranslation } from '@gustri/i18n';
import { ShoppingBag, TrendingUp, UserCheck } from 'lucide-react';
import type { StaffStats } from './use-staff-stats';

interface StaffPerformanceStatsProps {
  stats: StaffStats;
  formatPrice: (amount: number) => string;
}

export function StaffPerformanceStats({ stats, formatPrice }: StaffPerformanceStatsProps) {
  const { t } = useTranslation('staff');

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-2 text-blue-600 mb-1">
          <ShoppingBag className="h-4 w-4" />
          <span className="text-xs font-medium uppercase text-gray-500">
            {t('reports.ordersHandled')}
          </span>
        </div>
        <p className="text-2xl font-bold">{stats.ordersHandled}</p>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-2 text-green-600 mb-1">
          <TrendingUp className="h-4 w-4" />
          <span className="text-xs font-medium uppercase text-gray-500">
            {t('reports.revenue')}
          </span>
        </div>
        <p className="text-2xl font-bold">{formatPrice(stats.revenue)}</p>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-2 text-purple-600 mb-1">
          <ShoppingBag className="h-4 w-4" />
          <span className="text-xs font-medium uppercase text-gray-500">
            {t('reports.itemsSold')}
          </span>
        </div>
        <p className="text-2xl font-bold">{stats.itemsSold}</p>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-2 text-indigo-600 mb-1">
          <UserCheck className="h-4 w-4" />
          <span className="text-xs font-medium uppercase text-gray-500">
            {t('reports.completionRate')}
          </span>
        </div>
        <p className="text-2xl font-bold">{stats.completionRate}%</p>
      </div>
    </div>
  );
}
