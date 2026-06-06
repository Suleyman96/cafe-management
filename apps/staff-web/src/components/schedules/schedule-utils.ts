import { getLocalDateString } from '@gustri/core';
import type { StaffSchedule as BaseStaffSchedule, Staff } from '@gustri/database/types';

// getWeekDates + getDurationHours are shared with the mobile schedules screen,
// so they live in @gustri/core; re-exported here so this module stays the
// single import surface for the staff-web schedule views.
export { getDurationHours, getWeekDates } from '@gustri/core';

/** A schedule row joined with the minimal staff projection the views render. */
export type StaffSchedule = BaseStaffSchedule & {
  staff?: Pick<Staff, 'full_name' | 'role'>;
};

export function getMonthDates(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  return { firstDay, lastDay, daysInMonth: lastDay.getDate() };
}

export function formatDate(d: Date): string {
  return getLocalDateString(d);
}

export function formatShortDate(d: Date, locale: string): string {
  return d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatTime(time: string): string {
  return time?.slice(0, 5) || '';
}

export function isToday(d: Date): boolean {
  return formatDate(d) === formatDate(new Date());
}

export const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  missed: 'bg-red-100 text-red-700',
};

export const STATUS_DOT: Record<string, string> = {
  scheduled: 'bg-gray-400',
  in_progress: 'bg-blue-500',
  completed: 'bg-green-500',
  missed: 'bg-red-500',
};
