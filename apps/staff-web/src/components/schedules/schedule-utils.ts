import { getLocalDateString } from '@gustri/core';
import type { StaffSchedule as BaseStaffSchedule, Staff } from '@gustri/database/types';

/** A schedule row joined with the minimal staff projection the views render. */
export type StaffSchedule = BaseStaffSchedule & {
  staff?: Pick<Staff, 'full_name' | 'role'>;
};

/** The 7 dates (Mon–Sun) of the week containing `referenceDate`. */
export function getWeekDates(referenceDate: Date): Date[] {
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

export function getMonthDates(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  return { firstDay, lastDay, daysInMonth: lastDay.getDate() };
}

export function formatDate(d: Date): string {
  return getLocalDateString(d);
}

export function formatShortDate(d: Date): string {
  return d.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatTime(time: string): string {
  return time?.slice(0, 5) || '';
}

export function getDurationHours(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
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
