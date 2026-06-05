import type { StaffSchedule } from '@gustri/database/types';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, tenantKey } from '../keys';
import { useDb, useTenantId } from '../provider';

export function useSchedulesByDate(date: string, options?: { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.SCHEDULES, date),
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
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.SCHEDULES, startDate, endDate),
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
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.MY_SCHEDULE, staffId, startDate, endDate),
    queryFn: () =>
      db.schedules.findByStaffRange(staffId, startDate, endDate) as Promise<StaffSchedule[]>,
    enabled: !!staffId && !!startDate && !!endDate && (options?.enabled ?? true),
  });
}

export function useMyScheduleToday(staffId: string, options?: { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  const today = new Date().toLocaleDateString('en-CA');
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.MY_SCHEDULE, staffId, 'today'),
    queryFn: () => db.schedules.findByStaffAndDate(staffId, today) as Promise<StaffSchedule[]>,
    enabled: !!staffId && (options?.enabled ?? true),
  });
}
