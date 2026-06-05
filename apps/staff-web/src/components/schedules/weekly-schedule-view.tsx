'use client';

import type { Staff } from '@gustri/database/types';
import { useTranslation } from '@gustri/i18n';
import { User } from 'lucide-react';
import {
  formatDate,
  formatTime,
  isToday,
  STATUS_COLORS,
  STATUS_DOT,
  type StaffSchedule,
} from './schedule-utils';

interface WeeklyScheduleViewProps {
  weekDates: Date[];
  schedulesByStaff: Record<string, { staff: Staff; schedules: Record<string, StaffSchedule[]> }>;
  isLoading: boolean;
  onCreate: (defaultDate?: string) => void;
  onEdit: (schedule: StaffSchedule) => void;
}

export function WeeklyScheduleView({
  weekDates,
  schedulesByStaff,
  isLoading,
  onCreate,
  onEdit,
}: WeeklyScheduleViewProps) {
  const { t } = useTranslation('staff');

  return (
    <div className="bg-white rounded-lg shadow overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-40">
              {t('schedules.staffHeader')}
            </th>
            {weekDates.map((d) => (
              <th
                key={formatDate(d)}
                className={`px-2 py-3 text-center text-xs font-medium uppercase min-w-[110px] ${
                  isToday(d) ? 'text-blue-600 bg-blue-50/50' : 'text-gray-500'
                }`}
              >
                <div>{d.toLocaleDateString('default', { weekday: 'short' })}</div>
                <div className="text-sm font-bold">
                  {d.toLocaleDateString('default', { day: 'numeric', month: 'short' })}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Object.values(schedulesByStaff).map(({ staff: s, schedules: staffSchedules }) => (
            <tr key={s.id}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-gray-500" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{s.full_name}</div>
                    <div className="text-xs text-gray-500 capitalize">{s.role}</div>
                  </div>
                </div>
              </td>
              {weekDates.map((d) => {
                const dateKey = formatDate(d);
                const daySchedules = staffSchedules[dateKey] || [];
                return (
                  <td
                    key={dateKey}
                    className={`px-2 py-2 text-center ${isToday(d) ? 'bg-blue-50/30' : ''}`}
                  >
                    {daySchedules.length > 0 ? (
                      daySchedules.map((sched: StaffSchedule) => (
                        <button
                          key={sched.id}
                          onClick={() => onEdit(sched)}
                          className={`block w-full mb-1 last:mb-0 px-2 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-opacity hover:opacity-80 ${
                            STATUS_COLORS[sched.status] || STATUS_COLORS.scheduled
                          }`}
                          type="button"
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[sched.status] || STATUS_DOT.scheduled}`}
                            />
                            {formatTime(sched.planned_start)} - {formatTime(sched.planned_end)}
                          </div>
                          <div className="text-[10px] opacity-70 truncate">
                            {sched.staff?.full_name || s.full_name}
                          </div>
                        </button>
                      ))
                    ) : (
                      <button
                        onClick={() => onCreate(dateKey)}
                        className="w-full px-2 py-1.5 rounded-md text-xs text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors"
                        type="button"
                      >
                        +
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {Object.keys(schedulesByStaff).length === 0 && !isLoading && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                {t('schedules.noActiveStaff')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
