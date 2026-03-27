'use client';

import { getLocalDateString } from '@cafe-idare/core';
import type { StaffSchedule } from '@cafe-idare/database';
import { useTranslation } from '@cafe-idare/i18n';
import { Button } from '@cafe-idare/ui';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Plus, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ScheduleModal } from '@/components/modals/schedule-modal';
import { useSchedulesByDateRange, useStaff } from '@/hooks';
import { useAuth } from '@/hooks/use-auth';

function getWeekDates(referenceDate: Date) {
  const d = new Date(referenceDate);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as first day
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);

  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date);
  }
  return dates;
}

function getMonthDates(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  return { firstDay, lastDay, daysInMonth: lastDay.getDate() };
}

function formatDate(d: Date) {
  return getLocalDateString(d);
}

function formatShortDate(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(time: string) {
  return time?.slice(0, 5) || '';
}

function getDurationHours(start: string | null, end: string | null) {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  missed: 'bg-red-100 text-red-700',
};

const STATUS_DOT: Record<string, string> = {
  scheduled: 'bg-gray-400',
  in_progress: 'bg-blue-500',
  completed: 'bg-green-500',
  missed: 'bg-red-500',
};

export default function SchedulesPage() {
  const { t } = useTranslation('staff');
  const { staff: currentUser } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [viewMode, setViewMode] = useState<'weekly' | 'daily' | 'monthly'>('weekly');
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [showModal, setShowModal] = useState(false);
  const [editSchedule, setEditSchedule] = useState<any>(null);

  const weekDates = useMemo(() => {
    const ref = new Date();
    ref.setDate(ref.getDate() + weekOffset * 7);
    return getWeekDates(ref);
  }, [weekOffset]);

  const monthInfo = useMemo(() => {
    const ref = new Date();
    ref.setMonth(ref.getMonth() + monthOffset);
    return getMonthDates(ref.getFullYear(), ref.getMonth());
  }, [monthOffset]);

  const startDate =
    viewMode === 'monthly' ? formatDate(monthInfo.firstDay) : formatDate(weekDates[0]);
  const endDate = viewMode === 'monthly' ? formatDate(monthInfo.lastDay) : formatDate(weekDates[6]);

  const { data: schedules, isLoading, refetch } = useSchedulesByDateRange(startDate, endDate);
  const { data: staffList } = useStaff();

  // Group schedules by staff for weekly view
  const schedulesByStaff = useMemo(() => {
    if (!schedules || !staffList) return {};
    const map: Record<string, { staff: any; schedules: Record<string, any[]> }> = {};

    // Initialize with all active staff
    for (const s of staffList.filter((s: any) => s.is_active)) {
      map[s.id] = { staff: s, schedules: {} };
      for (const d of weekDates) {
        map[s.id].schedules[formatDate(d)] = [];
      }
    }

    for (const sched of schedules as StaffSchedule[]) {
      const sid = sched.staff_id;
      if (map[sid]) {
        const dateKey = sched.date;
        if (!map[sid].schedules[dateKey]) map[sid].schedules[dateKey] = [];
        map[sid].schedules[dateKey].push(sched);
      }
    }

    return map;
  }, [schedules, staffList, weekDates]);

  // Daily view: filter schedules for selected date
  const dailySchedules = useMemo(() => {
    if (!schedules) return [];
    return schedules.filter((s: any) => s.date === selectedDate);
  }, [schedules, selectedDate]);

  // Monthly view: group schedules by date
  const monthlyByDate = useMemo(() => {
    if (!schedules) return {};
    const map: Record<string, StaffSchedule[]> = {};
    for (const sched of schedules as StaffSchedule[]) {
      const dateKey = sched.date;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(sched);
    }
    return map;
  }, [schedules]);

  // Only admins can access
  if (currentUser?.role !== 'admin' && currentUser?.role !== 'owner') {
    return (
      <div className="p-3 sm:p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {t('schedules.accessDeniedAdmin')}
        </div>
      </div>
    );
  }

  const handleOpenCreate = (defaultDate?: string) => {
    setEditSchedule(null);
    setShowModal(true);
    if (defaultDate) setSelectedDate(defaultDate);
  };

  const handleOpenEdit = (schedule: any) => {
    setEditSchedule(schedule);
    setShowModal(true);
  };

  const handleModalSuccess = () => {
    setShowModal(false);
    setEditSchedule(null);
    refetch();
  };

  const isToday = (d: Date) => formatDate(d) === formatDate(new Date());

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('schedules.title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'monthly' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              }`}
              type="button"
            >
              {t('schedules.monthly')}
            </button>
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'weekly' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              }`}
              type="button"
            >
              {t('schedules.weekly')}
            </button>
            <button
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'daily' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
              }`}
              type="button"
            >
              {t('schedules.daily')}
            </button>
          </div>
          <Button size="sm" onClick={() => handleOpenCreate(selectedDate)}>
            <Plus className="h-4 w-4 mr-1" />
            {t('schedules.addSchedule')}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow px-4 py-3">
        <button
          onClick={() =>
            viewMode === 'monthly' ? setMonthOffset((p) => p - 1) : setWeekOffset((p) => p - 1)
          }
          className="p-1 rounded hover:bg-gray-100"
          type="button"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          {viewMode === 'monthly' ? (
            <span className="text-sm font-medium text-gray-900">
              {monthInfo.firstDay.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </span>
          ) : (
            <span className="text-sm font-medium text-gray-900">
              {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
              {weekDates[6].toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          )}
          {viewMode === 'monthly'
            ? monthOffset !== 0 && (
                <button
                  onClick={() => setMonthOffset(0)}
                  className="text-xs text-blue-600 hover:underline"
                  type="button"
                >
                  {t('thisMonth', { ns: 'common' })}
                </button>
              )
            : weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className="text-xs text-blue-600 hover:underline"
                  type="button"
                >
                  {t('today', { ns: 'common' })}
                </button>
              )}
        </div>
        <button
          onClick={() =>
            viewMode === 'monthly' ? setMonthOffset((p) => p + 1) : setWeekOffset((p) => p + 1)
          }
          className="p-1 rounded hover:bg-gray-100"
          type="button"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Weekly View */}
      {viewMode === 'weekly' && (
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
                    <div>{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div className="text-sm font-bold">
                      {d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
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
                          daySchedules.map((sched: any) => (
                            <button
                              key={sched.id}
                              onClick={() => handleOpenEdit(sched)}
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
                            onClick={() => handleOpenCreate(dateKey)}
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
      )}

      {/* Daily View */}
      {viewMode === 'daily' && (
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
                {formatShortDate(d)}
              </button>
            ))}
          </div>

          {/* Daily schedule table */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 sm:px-6 py-3 border-b">
              <h2 className="text-lg font-semibold">
                {new Date(selectedDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </h2>
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
                    {dailySchedules.map((sched: any) => {
                      const duration = getDurationHours(sched.actual_start, sched.actual_end);
                      return (
                        <tr
                          key={sched.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => handleOpenEdit(sched)}
                        >
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">
                              {sched.staff?.full_name || 'Unknown'}
                            </div>
                            <div className="text-xs text-gray-500 capitalize">
                              {sched.staff?.role}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-gray-400" />
                              {formatTime(sched.planned_start)} - {formatTime(sched.planned_end)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {sched.actual_start
                              ? new Date(sched.actual_start).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {sched.actual_end
                              ? new Date(sched.actual_end).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '-'}
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
      )}

      {/* Monthly View */}
      {viewMode === 'monthly' && (
        <div className="bg-white rounded-lg shadow">
          {/* Calendar header */}
          <div className="grid grid-cols-7 border-b">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
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
                  <div
                    key={`empty-${i}`}
                    className="border-b border-r p-2 min-h-[80px] bg-gray-50"
                  />,
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
                        onClick={() => handleOpenCreate(dateKey)}
                        className="text-gray-300 hover:text-gray-500 text-xs"
                        type="button"
                      >
                        +
                      </button>
                    </div>
                    <div className="space-y-0.5">
                      {daySchedules.map((sched: any) => (
                        <button
                          key={sched.id}
                          onClick={() => handleOpenEdit(sched)}
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
      )}

      {/* Modal */}
      {showModal && (
        <ScheduleModal
          schedule={editSchedule}
          defaultDate={selectedDate}
          onClose={() => {
            setShowModal(false);
            setEditSchedule(null);
          }}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}
