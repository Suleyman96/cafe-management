'use client';

import { useDateFormatter, useLocale, useTranslation } from '@gustri/i18n';
import { Clock } from 'lucide-react';
import {
  formatDate,
  formatShortDate,
  formatTime,
  getDurationHours,
  isToday,
  STATUS_COLORS,
  STATUS_DOT,
  type StaffSchedule,
} from './schedule-utils';

interface DailyScheduleViewProps {
  weekDates: Date[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  dailySchedules: StaffSchedule[];
  isLoading: boolean;
  onEdit: (schedule: StaffSchedule) => void;
}

export function DailyScheduleView({
  weekDates,
  selectedDate,
  setSelectedDate,
  dailySchedules,
  isLoading,
  onEdit,
}: DailyScheduleViewProps) {
  const { t } = useTranslation('staff');
  const locale = useLocale();
  const dfFullDate = useDateFormatter({
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const dfTime = useDateFormatter({ hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-4">
      {/* Day selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {weekDates.map((d) => (
          <button
            key={formatDate(d)}
            onClick={() => setSelectedDate(formatDate(d))}
            className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedDate === formatDate(d)
                ? 'bg-blue-500 text-white'
                : isToday(d)
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
            type="button"
          >
            {formatShortDate(d, locale)}
          </button>
        ))}
      </div>

      {/* Daily schedule table */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 sm:px-6 py-3 border-b">
          <h2 className="text-lg font-semibold">{dfFullDate.format(new Date(selectedDate))}</h2>
        </div>
        {isLoading ? (
          <div className="p-6 text-center text-sm text-gray-500">
            {t('loading', { ns: 'common' })}...
          </div>
        ) : dailySchedules.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            {t('schedules.noSchedulesDay')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('schedules.staffHeader')}
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
                    {t('schedules.duration')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('status', { ns: 'common' })}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {t('notes', { ns: 'common' })}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dailySchedules.map((sched: StaffSchedule) => {
                  const duration = getDurationHours(sched.actual_start, sched.actual_end);
                  return (
                    <tr
                      key={sched.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => onEdit(sched)}
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {sched.staff?.full_name || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500 capitalize">{sched.staff?.role}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          {formatTime(sched.planned_start)} - {formatTime(sched.planned_end)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {sched.actual_start ? dfTime.format(new Date(sched.actual_start)) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {sched.actual_end ? dfTime.format(new Date(sched.actual_end)) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {duration != null ? `${duration}h` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_COLORS[sched.status] || STATUS_COLORS.scheduled
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[sched.status] || STATUS_DOT.scheduled}`}
                          />
                          {sched.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-[150px] truncate">
                        {sched.notes || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
