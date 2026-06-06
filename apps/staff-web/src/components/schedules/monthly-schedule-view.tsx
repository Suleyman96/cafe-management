'use client';

import { useDateFormatter } from '@gustri/i18n';
import type React from 'react';
import { formatDate, formatTime, STATUS_COLORS, type StaffSchedule } from './schedule-utils';

interface MonthlyScheduleViewProps {
  monthInfo: { firstDay: Date; lastDay: Date; daysInMonth: number };
  monthlyByDate: Record<string, StaffSchedule[]>;
  onCreate: (defaultDate?: string) => void;
  onEdit: (schedule: StaffSchedule) => void;
}

export function MonthlyScheduleView({
  monthInfo,
  monthlyByDate,
  onCreate,
  onEdit,
}: MonthlyScheduleViewProps) {
  const dfWeekday = useDateFormatter({ weekday: 'short' });
  return (
    <div className="bg-white rounded-lg shadow">
      {/* Calendar header */}
      <div className="grid grid-cols-7 border-b">
        {Array.from({ length: 7 }, (_, i) => {
          // Find a Monday in the current week to generate locale-aware day names
          const now = new Date();
          const monday = new Date(now);
          monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);
          return dfWeekday.format(d);
        }).map((day) => (
          <div
            key={day}
            className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase"
          >
            {day}
          </div>
        ))}
      </div>
      {/* Calendar body */}
      <div className="grid grid-cols-7">
        {(() => {
          const cells: React.ReactNode[] = [];
          const year = monthInfo.firstDay.getFullYear();
          const month = monthInfo.firstDay.getMonth();
          // Monday=0 offset: getDay() returns 0=Sun, so Mon=1..Sun=0 -> offset
          const firstDayOfWeek = monthInfo.firstDay.getDay();
          const emptyBefore = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

          for (let i = 0; i < emptyBefore; i++) {
            cells.push(
              <div key={`empty-${i}`} className="border-b border-r p-2 min-h-[80px] bg-gray-50" />,
            );
          }

          const todayStr = formatDate(new Date());
          for (let day = 1; day <= monthInfo.daysInMonth; day++) {
            const d = new Date(year, month, day);
            const dateKey = formatDate(d);
            const daySchedules = monthlyByDate[dateKey] || [];
            const isTodayCell = dateKey === todayStr;

            cells.push(
              <div
                key={dateKey}
                className={`border-b border-r p-1.5 min-h-[80px] ${isTodayCell ? 'bg-blue-50/50' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-medium ${isTodayCell ? 'text-blue-600 font-bold' : 'text-gray-700'}`}
                  >
                    {day}
                  </span>
                  <button
                    onClick={() => onCreate(dateKey)}
                    className="text-gray-300 hover:text-gray-500 text-xs"
                    type="button"
                  >
                    +
                  </button>
                </div>
                <div className="space-y-0.5">
                  {daySchedules.map((sched: StaffSchedule) => (
                    <button
                      key={sched.id}
                      onClick={() => onEdit(sched)}
                      className={`block w-full text-left px-1 py-0.5 rounded text-[10px] font-medium truncate cursor-pointer hover:opacity-80 ${
                        STATUS_COLORS[sched.status] || STATUS_COLORS.scheduled
                      }`}
                      type="button"
                      title={`${sched.staff?.full_name}: ${formatTime(sched.planned_start)}-${formatTime(sched.planned_end)}`}
                    >
                      {sched.staff?.full_name?.split(' ')[0]} {formatTime(sched.planned_start)}
                    </button>
                  ))}
                </div>
              </div>,
            );
          }

          // Fill remaining cells to complete last row
          const totalCells = emptyBefore + monthInfo.daysInMonth;
          const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
          for (let i = 0; i < remaining; i++) {
            cells.push(
              <div
                key={`empty-end-${i}`}
                className="border-b border-r p-2 min-h-[80px] bg-gray-50"
              />,
            );
          }

          return cells;
        })()}
      </div>
    </div>
  );
}
