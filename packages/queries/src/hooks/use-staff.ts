import type { Staff } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, tenantKey } from '../keys';
import { useDb, useTenantId } from '../provider';

export function useStaff(role?: Staff['role'], options?: { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.STAFF, role),
    queryFn: () => db.staff.findAll(role ? { role } : undefined) as Promise<Staff[]>,
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export function useStaffMember(id: string, options?: { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.STAFF_MEMBER, id),
    queryFn: () => db.staff.findById(id) as Promise<Staff>,
    enabled: !!id && (options?.enabled ?? true),
  });
}

export function useActiveWaiters(options?: { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.STAFF, 'active_waiters'),
    queryFn: () => db.staff.getActiveWaiters() as Promise<Staff[]>,
    enabled: options?.enabled ?? true,
  });
}

export function useStaffByEmail(email: string, options?: { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.STAFF, 'email', email),
    queryFn: () => db.staff.findByEmail(email) as Promise<Staff>,
    enabled: !!email && (options?.enabled ?? true),
  });
}
