import type { Staff } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '../keys';
import { useDb } from '../provider';

export function useStaff(role?: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.STAFF, role],
    queryFn: () => db.staff.findAll(role ? { role } : undefined) as Promise<Staff[]>,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStaffMember(id: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.STAFF_MEMBER, id],
    queryFn: () => db.staff.findById(id) as Promise<Staff>,
    enabled: !!id,
  });
}

export function useActiveWaiters() {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.STAFF, 'active_waiters'],
    queryFn: () => db.staff.getActiveWaiters() as Promise<Staff[]>,
  });
}

export function useStaffByEmail(email: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.STAFF, 'email', email],
    queryFn: () => db.staff.findByEmail(email) as Promise<Staff>,
    enabled: !!email,
  });
}
