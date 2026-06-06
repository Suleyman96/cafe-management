'use client';

import { getLocalDateString } from '@gustri/core';
import { useDateFormatter } from '@gustri/i18n';
import { useMemo, useState } from 'react';

export type DateRangeType = 'today' | 'week' | 'month' | 'year' | 'custom';
export type CustomMode = 'day' | 'month' | 'year';

/**
 * Owns the reports page's date-range selection: preset ranges (today / week /
 * month / year) plus a custom day/month/year picker with prev/next navigation.
 * Returns the derived ISO and `YYYY-MM-DD` ranges the report hooks consume,
 * plus the human-readable label used by the header and the PDF export.
 *
 * Extracted verbatim from ReportsPage — behavior unchanged.
 */
export function useReportDateRange() {
  const dfFullDate = useDateFormatter({
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const dfMonthYear = useDateFormatter({ month: 'long', year: 'numeric' });
  const dfShortDate = useDateFormatter({ month: 'short', day: 'numeric' });
  const dfShortDateYear = useDateFormatter({
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  // English-only formatters for the PDF export. jsPDF's default font can't
  // render non-Latin scripts (Japanese/Arabic/Thai would be missing glyphs)
  // and the filename is derived from the label, so the PDF period + filename
  // stay English per the bulk-export-is-English-only policy. The on-screen
  // header uses the locale-aware formatters above.
  const enFullDate = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    [],
  );
  const enMonthYear = useMemo(
    () => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }),
    [],
  );
  const enShortDate = useMemo(
    () => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }),
    [],
  );
  const enShortDateYear = useMemo(
    () => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    [],
  );
  const [dateRange, setDateRange] = useState<DateRangeType>('today');
  const [customMode, setCustomMode] = useState<CustomMode>('day');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Get date range filter - returns { start, end } for the selected period
  const getDateRange = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (dateRange === 'custom') {
      if (customMode === 'day') {
        const start = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
        );
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        return { start, end };
      } else if (customMode === 'month') {
        const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1);
        return { start, end };
      } else if (customMode === 'year') {
        const start = new Date(selectedDate.getFullYear(), 0, 1);
        const end = new Date(selectedDate.getFullYear() + 1, 0, 1);
        return { start, end };
      }
    }

    switch (dateRange) {
      case 'today':
        return { start: today, end: tomorrow };
      case 'week': {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 6);
        return { start: weekStart, end: tomorrow };
      }
      case 'month': {
        const monthStart = new Date(today);
        monthStart.setDate(today.getDate() - 29);
        return { start: monthStart, end: tomorrow };
      }
      case 'year': {
        const yearStart = new Date(today);
        yearStart.setFullYear(today.getFullYear() - 1);
        return { start: yearStart, end: tomorrow };
      }
      default:
        return { start: today, end: tomorrow };
    }
  }, [dateRange, customMode, selectedDate]);

  // Convert date range to ISO strings for the report hooks
  const dateStrings = useMemo(() => {
    const from = getDateRange.start.toISOString();
    const to = getDateRange.end.toISOString();
    return { from, to };
  }, [getDateRange]);

  // Convert date range to 'YYYY-MM-DD' strings for expenses/waste date filters
  const expenseDateRange = useMemo(() => {
    const fmt = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    return { startDate: fmt(getDateRange.start), endDate: fmt(getDateRange.end) };
  }, [getDateRange]);

  // Check if we can navigate to next (prevent future dates)
  const canNavigateNext = useMemo(() => {
    const now = new Date();
    if (customMode === 'day') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const selected = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
      );
      return selected < today;
    } else if (customMode === 'month') {
      return (
        selectedDate.getFullYear() < now.getFullYear() ||
        (selectedDate.getFullYear() === now.getFullYear() &&
          selectedDate.getMonth() < now.getMonth())
      );
    } else {
      return selectedDate.getFullYear() < now.getFullYear();
    }
  }, [customMode, selectedDate]);

  // Navigate custom date selection
  const navigateDate = (direction: 'prev' | 'next') => {
    if (direction === 'next' && !canNavigateNext) return;

    const newDate = new Date(selectedDate);
    if (customMode === 'day') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (customMode === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    } else if (customMode === 'year') {
      newDate.setFullYear(newDate.getFullYear() + (direction === 'next' ? 1 : -1));
    }
    setSelectedDate(newDate);
  };

  // Get today's date string for max attribute
  const todayString = getLocalDateString();
  const currentMonthString = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  // Build the human-readable range label from a given set of formatters, so the
  // same logic produces both the locale-aware on-screen label and the
  // English-only PDF label.
  type RangeFmts = {
    fullDate: Intl.DateTimeFormat;
    monthYear: Intl.DateTimeFormat;
    shortDate: Intl.DateTimeFormat;
    shortDateYear: Intl.DateTimeFormat;
  };
  const customDateDisplay = (f: RangeFmts): string => {
    if (customMode === 'day') {
      return f.fullDate.format(selectedDate);
    } else if (customMode === 'month') {
      return f.monthYear.format(selectedDate);
    } else {
      return selectedDate.getFullYear().toString();
    }
  };
  const buildRangeLabel = (f: RangeFmts): string => {
    if (dateRange === 'custom') {
      return customDateDisplay(f);
    }

    const { start, end } = getDateRange;
    const formatDate = (d: Date) =>
      dateRange === 'year' ? f.shortDateYear.format(d) : f.shortDate.format(d);

    switch (dateRange) {
      case 'today':
        return formatDate(new Date());
      case 'week':
      case 'month':
      case 'year': {
        const endDisplay = new Date(end);
        endDisplay.setDate(endDisplay.getDate() - 1);
        return `${formatDate(start)} - ${formatDate(endDisplay)}`;
      }
      default:
        return '';
    }
  };

  const localizedFmts: RangeFmts = {
    fullDate: dfFullDate,
    monthYear: dfMonthYear,
    shortDate: dfShortDate,
    shortDateYear: dfShortDateYear,
  };
  const englishFmts: RangeFmts = {
    fullDate: enFullDate,
    monthYear: enMonthYear,
    shortDate: enShortDate,
    shortDateYear: enShortDateYear,
  };

  // Locale-aware label for the on-screen header.
  const getDateRangeLabel = (): string => buildRangeLabel(localizedFmts);
  // English label for the PDF export + filename (see formatter note above).
  const getDateRangeLabelEn = (): string => buildRangeLabel(englishFmts);

  return {
    dateRange,
    setDateRange,
    customMode,
    setCustomMode,
    selectedDate,
    setSelectedDate,
    dateStrings,
    expenseDateRange,
    canNavigateNext,
    navigateDate,
    todayString,
    currentMonthString,
    getDateRangeLabel,
    getDateRangeLabelEn,
  };
}
