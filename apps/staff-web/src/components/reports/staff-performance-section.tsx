'use client';

import { useTranslation } from '@gustri/i18n';
import { getRoleBadgeColor } from '@gustri/ui-web';
import { Award, BarChart3, UserCheck } from 'lucide-react';
import type { StaffMember } from '@/lib/report-pdf-export';

interface StaffPerformanceSectionProps {
  staffPerformance: StaffMember[];
  formatPrice: (amount: number) => string;
}

function RankBadge({ index }: { index: number }) {
  const colors =
    index === 0
      ? 'bg-yellow-100 text-yellow-800'
      : index === 1
        ? 'bg-gray-200 text-gray-700'
        : index === 2
          ? 'bg-orange-100 text-orange-800'
          : 'bg-gray-100 text-gray-600';

  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full text-xs font-bold ${colors}`}
    >
      {index + 1}
    </span>
  );
}

function RoleBadge({ role, t }: { role: string; t: (key: string) => string }) {
  // Single source of truth for role→badge colors (was an inline reimplementation
  // that could drift from the canonical palette).
  return (
    <span
      className={`px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(role)}`}
    >
      {t(`staffMgmt.role.${role}`)}
    </span>
  );
}

export function StaffPerformanceSection({
  staffPerformance,
  formatPrice,
}: StaffPerformanceSectionProps) {
  const { t } = useTranslation('staff');

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-6">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
        <h2 className="text-base sm:text-lg font-semibold">{t('reports.staffPerformance')}</h2>
      </div>

      {staffPerformance.length === 0 ? (
        <p className="text-gray-500 text-center py-6 sm:py-8 text-sm">{t('reports.noStaffData')}</p>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {/* Top Performer Highlight */}
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <Award className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-yellow-700">{t('reports.topPerformer')}</p>
                <p className="text-sm sm:text-lg font-bold text-yellow-900 truncate">
                  {/* guarded by staffPerformance.length === 0 check above */}
                  {staffPerformance[0]?.name}
                </p>
                <p className="text-xs sm:text-sm text-yellow-700">
                  {t('reports.revenueFromOrders', {
                    revenue: formatPrice(staffPerformance[0]?.revenue ?? 0),
                    count: staffPerformance[0]?.ordersHandled ?? 0,
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs sm:text-sm text-gray-600">
                  <th className="pb-3 font-medium">{t('reports.rank')}</th>
                  <th className="pb-3 font-medium">{t('staffMgmt.staffMember')}</th>
                  <th className="pb-3 font-medium">{t('settings.role')}</th>
                  <th className="pb-3 font-medium text-right">{t('reports.ordersHandled')}</th>
                  <th className="pb-3 font-medium text-right">{t('reports.itemsSoldCol')}</th>
                  <th className="pb-3 font-medium text-right">{t('reports.revenue')}</th>
                  <th className="pb-3 font-medium text-right">{t('reports.avgOrder')}</th>
                  <th className="pb-3 font-medium text-right">{t('reports.completion')}</th>
                </tr>
              </thead>
              <tbody>
                {staffPerformance.map((member, index) => {
                  const completionRate =
                    member.ordersHandled > 0
                      ? Math.round((member.completedOrders / member.ordersHandled) * 100)
                      : 0;
                  return (
                    <tr key={member.id} className="border-b last:border-0">
                      <td className="py-3">
                        <RankBadge index={index} />
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                          <span className="font-medium text-xs sm:text-sm">{member.name}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <RoleBadge role={member.role} t={t} />
                      </td>
                      <td className="py-3 text-right text-xs sm:text-sm">{member.ordersHandled}</td>
                      <td className="py-3 text-right text-xs sm:text-sm">{member.itemsSold}</td>
                      <td className="py-3 text-right font-medium text-green-600 text-xs sm:text-sm">
                        {formatPrice(member.revenue)}
                      </td>
                      <td className="py-3 text-right text-xs sm:text-sm">
                        {formatPrice(
                          member.ordersHandled > 0 ? member.revenue / member.ordersHandled : 0,
                        )}
                      </td>
                      <td className="py-3 text-right text-xs sm:text-sm">
                        <span
                          className={`font-medium ${completionRate >= 90 ? 'text-green-600' : 'text-gray-600'}`}
                        >
                          {completionRate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="sm:hidden space-y-2">
            {staffPerformance.map((member, index) => {
              const completionRate =
                member.ordersHandled > 0
                  ? Math.round((member.completedOrders / member.ordersHandled) * 100)
                  : 0;
              return (
                <div key={member.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <RankBadge index={index} />
                      <span className="font-medium text-sm truncate">{member.name}</span>
                    </div>
                    <RoleBadge role={member.role} t={t} />
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <p className="font-bold text-blue-600">{member.ordersHandled}</p>
                      <p className="text-gray-500">{t('reports.ordersHandled')}</p>
                    </div>
                    <div>
                      <p className="font-bold text-purple-600">{member.itemsSold}</p>
                      <p className="text-gray-500">{t('reports.itemsSoldCol')}</p>
                    </div>
                    <div>
                      <p className="font-bold text-green-600">{formatPrice(member.revenue)}</p>
                      <p className="text-gray-500">{t('reports.revenue')}</p>
                    </div>
                    <div>
                      <p
                        className={`font-bold ${completionRate >= 90 ? 'text-green-600' : 'text-gray-600'}`}
                      >
                        {completionRate}%
                      </p>
                      <p className="text-gray-500">{t('reports.done')}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-3 sm:pt-4 border-t mt-3 sm:mt-4">
            <div className="text-center">
              <p className="text-lg sm:text-2xl font-bold text-blue-600">
                {staffPerformance.length}
              </p>
              <p className="text-xs text-gray-600">{t('reports.activeStaff')}</p>
            </div>
            <div className="text-center">
              <p className="text-lg sm:text-2xl font-bold text-green-600">
                {formatPrice(
                  staffPerformance.length > 0
                    ? staffPerformance.reduce((sum, s) => sum + s.revenue, 0) /
                        staffPerformance.length
                    : 0,
                )}
              </p>
              <p className="text-xs text-gray-600">{t('reports.avgRevenue')}</p>
            </div>
            <div className="text-center">
              <p className="text-lg sm:text-2xl font-bold text-purple-600">
                {staffPerformance.length > 0
                  ? (
                      staffPerformance.reduce((sum, s) => sum + s.ordersHandled, 0) /
                      staffPerformance.length
                    ).toFixed(1)
                  : '0'}
              </p>
              <p className="text-xs text-gray-600">{t('reports.avgOrders')}</p>
            </div>
            <div className="text-center">
              <p className="text-lg sm:text-2xl font-bold text-orange-600">
                {staffPerformance.length > 0
                  ? (
                      staffPerformance.reduce((sum, s) => sum + s.itemsSold, 0) /
                      staffPerformance.length
                    ).toFixed(1)
                  : '0'}
              </p>
              <p className="text-xs text-gray-600">{t('reports.avgItems')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
