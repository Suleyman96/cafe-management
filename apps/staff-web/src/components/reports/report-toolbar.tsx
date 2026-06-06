'use client';

import { getLocalDateString } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui-web';
import { Calendar, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import type {
  CustomMode,
  DateRangeType,
  useReportDateRange,
} from '@/components/reports/use-report-date-range';

type DateRangeState = ReturnType<typeof useReportDateRange>;

interface ReportToolbarProps {
  dateRange: DateRangeState['dateRange'];
  setDateRange: DateRangeState['setDateRange'];
  customMode: DateRangeState['customMode'];
  setCustomMode: DateRangeState['setCustomMode'];
  selectedDate: DateRangeState['selectedDate'];
  setSelectedDate: DateRangeState['setSelectedDate'];
  canNavigateNext: DateRangeState['canNavigateNext'];
  navigateDate: DateRangeState['navigateDate'];
  todayString: DateRangeState['todayString'];
  currentMonthString: DateRangeState['currentMonthString'];
  getDateRangeLabel: DateRangeState['getDateRangeLabel'];
  onExport: () => void;
}

export function ReportToolbar({
  dateRange,
  setDateRange,
  customMode,
  setCustomMode,
  selectedDate,
  setSelectedDate,
  canNavigateNext,
  navigateDate,
  todayString,
  currentMonthString,
  getDateRangeLabel,
  onExport,
}: ReportToolbarProps) {
  const { t } = useTranslation('staff');

  // Map range keys to translation keys
  const getRangeLabel = (range: DateRangeType): string => {
    switch (range) {
      case 'today':
        return t('reports.today');
      case 'week':
        return t('reports.week');
      case 'month':
        return t('reports.month');
      case 'year':
        return t('reports.year');
      case 'custom':
        return t('reports.custom');
      default:
        return range;
    }
  };

  // Map custom mode keys to translation keys
  const getCustomModeLabel = (mode: CustomMode): string => {
    switch (mode) {
      case 'day':
        return t('reports.day');
      case 'month':
        return t('reports.month');
      case 'year':
        return t('reports.year');
      default:
        return mode;
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t('reports.title')}</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />
            {getDateRangeLabel()}
          </p>
        </div>

        {/* Date Range Filter + Export Button */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 sm:pb-0 sm:flex-wrap">
            {(['today', 'week', 'month', 'year', 'custom'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex-shrink-0 ${
                  dateRange === range
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {getRangeLabel(range)}
              </button>
            ))}
          </div>
          <Button
            onClick={onExport}
            className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 w-full sm:w-auto"
            size="sm"
          >
            <Download className="h-4 w-4" />
            <span className="text-xs sm:text-sm">{t('reports.exportPdf')}</span>
          </Button>
        </div>
      </div>

      {/* Custom Date Picker */}
      {dateRange === 'custom' && (
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            {/* Mode Selection */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs sm:text-sm font-medium text-gray-700 mr-1 sm:mr-2">
                {t('reports.viewBy')}
              </span>
              {(['day', 'month', 'year'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setCustomMode(mode)}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    customMode === mode
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {getCustomModeLabel(mode)}
                </button>
              ))}
            </div>

            {/* Date Navigation */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => navigateDate('prev')}
                className="p-1.5 sm:p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors flex-shrink-0"
              >
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
              </button>

              <div className="flex-1 min-w-0 text-center">
                {customMode === 'day' && (
                  <input
                    type="date"
                    value={getLocalDateString(selectedDate)}
                    max={todayString}
                    onChange={(e) => setSelectedDate(new Date(`${e.target.value}T00:00:00`))}
                    className="w-full sm:w-auto px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                )}
                {customMode === 'month' && (
                  <input
                    type="month"
                    value={`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`}
                    max={currentMonthString}
                    onChange={(e) => {
                      const [year, month] = e.target.value.split('-');
                      setSelectedDate(new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1));
                    }}
                    className="w-full sm:w-auto px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                )}
                {customMode === 'year' && (
                  <select
                    value={selectedDate.getFullYear()}
                    onChange={(e) => setSelectedDate(new Date(parseInt(e.target.value, 10), 0, 1))}
                    className="w-full sm:w-auto px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(
                      (year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ),
                    )}
                  </select>
                )}
              </div>

              <button
                onClick={() => navigateDate('next')}
                disabled={!canNavigateNext}
                className={`p-1.5 sm:p-2 rounded-lg transition-colors flex-shrink-0 ${
                  canNavigateNext
                    ? 'bg-gray-100 hover:bg-gray-200'
                    : 'bg-gray-50 cursor-not-allowed'
                }`}
              >
                <ChevronRight
                  className={`h-4 w-4 sm:h-5 sm:w-5 ${canNavigateNext ? 'text-gray-600' : 'text-gray-300'}`}
                />
              </button>

              {/* Quick Jump to Today */}
              <button
                onClick={() => setSelectedDate(new Date())}
                className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium flex-shrink-0"
              >
                {t('today', { ns: 'common' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
