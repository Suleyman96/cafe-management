import type { StaffSchedule } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '../keys';
import { useDb } from '../provider';

export function useSchedulesByDate(date: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.SCHEDULES, date],
    queryFn: () => db.schedules.findByDate(date) as Promise<StaffSchedule[]>,
    enabled: !!date,
  });
}

export function useSchedulesByDateRange(startDate: string, endDate: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.SCHEDULES, startDate, endDate],
    queryFn: () => db.schedules.findByDateRange(startDate, endDate) as Promise<StaffSchedule[]>,
    enabled: !!startDate && !!endDate,
  });
}

export function useMySchedule(staffId: string, startDate: string, endDate: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.MY_SCHEDULE, staffId, startDate, endDate],
    queryFn: () =>
      db.schedules.findByStaffRange(staffId, startDate, endDate) as Promise<StaffSchedule[]>,
    enabled: !!staffId && !!startDate && !!endDate,
  });
}

export function useMyScheduleToday(staffId: string) {
  const db = useDb();
  const today = new Date().toLocaleDateString('en-CA');
  return useQuery({
    queryKey: [QUERY_KEYS.MY_SCHEDULE, staffId, 'today'],
    queryFn: () => db.schedules.findByStaffAndDate(staffId, today) as Promise<StaffSchedule[]>,
    enabled: !!staffId,
  });
}
