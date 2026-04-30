import type { StaffSchedule } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '../keys';
import { useDb } from '../provider';

export function useSchedulesByDate(date: string, options?: { enabled?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.SCHEDULES, date],
    queryFn: () => db.schedules.findByDate(date) as Promise<StaffSchedule[]>,
    enabled: !!date && (options?.enabled ?? true),
  });
}

export function useSchedulesByDateRange(
  startDate: string,
  endDate: string,
  options?: { enabled?: boolean },
) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.SCHEDULES, startDate, endDate],
    queryFn: () => db.schedules.findByDateRange(startDate, endDate) as Promise<StaffSchedule[]>,
    enabled: !!startDate && !!endDate && (options?.enabled ?? true),
  });
}

export function useMySchedule(
  staffId: string,
  startDate: string,
  endDate: string,
  options?: { enabled?: boolean },
) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.MY_SCHEDULE, staffId, startDate, endDate],
    queryFn: () =>
      db.schedules.findByStaffRange(staffId, startDate, endDate) as Promise<StaffSchedule[]>,
    enabled: !!staffId && !!startDate && !!endDate && (options?.enabled ?? true),
  });
}

export function useMyScheduleToday(staffId: string, options?: { enabled?: boolean }) {
  const db = useDb();
  const today = new Date().toLocaleDateString('en-CA');
  return useQuery({
    queryKey: [QUERY_KEYS.MY_SCHEDULE, staffId, 'today'],
    queryFn: () => db.schedules.findByStaffAndDate(staffId, today) as Promise<StaffSchedule[]>,
    enabled: !!staffId && (options?.enabled ?? true),
  });
}
