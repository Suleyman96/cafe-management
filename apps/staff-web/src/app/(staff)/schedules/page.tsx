'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui-web';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { ScheduleModal } from '@/components/modals/schedule-modal';
import { DailyScheduleView } from '@/components/schedules/daily-schedule-view';
import { MonthlyScheduleView } from '@/components/schedules/monthly-schedule-view';
import { useScheduleCalendar } from '@/components/schedules/use-schedule-calendar';
import { WeeklyScheduleView } from '@/components/schedules/weekly-schedule-view';
import { useAuth } from '@/hooks/use-auth';

export default function SchedulesPage() {
  const { t } = useTranslation('staff');
  const { staff: currentUser } = useAuth();
  const cal = useScheduleCalendar();
  const {
    viewMode,
    setViewMode,
    setWeekOffset,
    setMonthOffset,
    weekOffset,
    monthOffset,
    weekDates,
    monthInfo,
    selectedDate,
    setSelectedDate,
    isLoading,
    schedulesByStaff,
    dailySchedules,
    monthlyByDate,
    showModal,
    editSchedule,
    handleOpenCreate,
    handleOpenEdit,
    handleModalSuccess,
    closeModal,
  } = cal;

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
              {monthInfo.firstDay.toLocaleDateString('default', {
                month: 'long',
                year: 'numeric',
              })}
            </span>
          ) : (
            <span className="text-sm font-medium text-gray-900">
              {weekDates[0].toLocaleDateString('default', { month: 'short', day: 'numeric' })} -{' '}
              {weekDates[6].toLocaleDateString('default', {
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

      {viewMode === 'weekly' && (
        <WeeklyScheduleView
          weekDates={weekDates}
          schedulesByStaff={schedulesByStaff}
          isLoading={isLoading}
          onCreate={handleOpenCreate}
          onEdit={handleOpenEdit}
        />
      )}

      {viewMode === 'daily' && (
        <DailyScheduleView
          weekDates={weekDates}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          dailySchedules={dailySchedules}
          isLoading={isLoading}
          onEdit={handleOpenEdit}
        />
      )}

      {viewMode === 'monthly' && (
        <MonthlyScheduleView
          monthInfo={monthInfo}
          monthlyByDate={monthlyByDate}
          onCreate={handleOpenCreate}
          onEdit={handleOpenEdit}
        />
      )}

      {/* Modal */}
      {showModal && (
        <ScheduleModal
          schedule={editSchedule ?? undefined}
          defaultDate={selectedDate}
          onClose={closeModal}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}
