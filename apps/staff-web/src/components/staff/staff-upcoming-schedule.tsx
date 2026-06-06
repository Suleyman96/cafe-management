'use client';

import type { StaffSchedule } from '@gustri/database/types';
import { useDateFormatter, useTranslation } from '@gustri/i18n';

interface StaffUpcomingScheduleProps {
  upcomingSchedules: StaffSchedule[] | undefined;
}

export function StaffUpcomingSchedule({ upcomingSchedules }: StaffUpcomingScheduleProps) {
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const dfWeekdayShort = useDateFormatter({
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const dfTime = useDateFormatter({ hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 sm:px-6 py-3 border-b">
        <h2 className="text-lg font-semibold">{t('staffMgmt.upcomingSchedule')}</h2>
      </div>
      {!upcomingSchedules || upcomingSchedules.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-500">
          {t('staffMgmt.noUpcomingSchedules')}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  {tCommon('date')}
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('schedules.planned')}
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('schedules.actualStart')}
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('schedules.actualEnd')}
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  {tCommon('status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {upcomingSchedules.map((sched) => {
                const schedStatusColors: Record<string, string> = {
                  scheduled: 'bg-gray-100 text-gray-700',
                  in_progress: 'bg-blue-100 text-blue-700',
                  completed: 'bg-green-100 text-green-700',
                  missed: 'bg-red-100 text-red-700',
                };
                return (
                  <tr key={sched.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {dfWeekdayShort.format(new Date(sched.date))}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {sched.planned_start?.slice(0, 5)} - {sched.planned_end?.slice(0, 5)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {sched.actual_start ? dfTime.format(new Date(sched.actual_start)) : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {sched.actual_end ? dfTime.format(new Date(sched.actual_end)) : '-'}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          schedStatusColors[sched.status] || schedStatusColors.scheduled
                        }`}
                      >
                        {sched.status.replace('_', ' ')}
                      </span>
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
