'use client';

import { getLocalDateString } from '@gustri/core';
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

  // Format display for custom selection
  const getCustomDateDisplay = (): string => {
    if (customMode === 'day') {
      return selectedDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } else if (customMode === 'month') {
      return selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else {
      return selectedDate.getFullYear().toString();
    }
  };

  // Get human-readable date range label
  const getDateRangeLabel = (): string => {
    if (dateRange === 'custom') {
      return getCustomDateDisplay();
    }

    const { start, end } = getDateRange;
    const formatDate = (d: Date) =>
      d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: dateRange === 'year' ? 'numeric' : undefined,
      });

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
  };
}
