/**
 * Type-Safe Staff Hooks
 * Uses the wrapped client for type safety without 'as any'
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';
import { QUERY_KEYS, USER_ROLE } from '@cafe-idare/core';
import type { Database } from '@cafe-idare/database';

type StaffInsert = Database['public']['Tables']['staff']['Insert'];
type StaffUpdate = Database['public']['Tables']['staff']['Update'];

export function useStaff(role?: keyof typeof USER_ROLE) {
  return useQuery({
    queryKey: [QUERY_KEYS.STAFF, role],
    queryFn: () => db.staff.findAll(role ? USER_ROLE[role] : undefined),
  });
}

export function useActiveWaiters() {
  return useQuery({
    queryKey: [QUERY_KEYS.STAFF, 'waiters'],
    queryFn: () => db.staff.getActiveWaiters(),
  });
}

export function useStaffMember(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.STAFF, id],
    queryFn: () => db.staff.findById(id),
    enabled: !!id,
  });
}

export function useStaffByEmail(email: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.STAFF, 'email', email],
    queryFn: () => db.staff.findByEmail(email),
    enabled: !!email,
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (staff: StaffInsert) => db.staff.create(staff),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STAFF] });
    },
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: StaffUpdate }) => 
      db.staff.update(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STAFF] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STAFF, data.id] });
    },
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => db.staff.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STAFF] });
    },
  });
}

// Helper function to get staff by role
export function useStaffByRole() {
  const { data: staff, ...rest } = useStaff();
  
  const staffByRole = staff?.reduce((acc, member) => {
    const role = member.role || 'other';
    if (!acc[role]) {
      acc[role] = [];
    }
    acc[role].push(member);
    return acc;
  }, {} as Record<string, typeof staff>);
  
  return {
    ...rest,
    data: {
      all: staff || [],
      byRole: staffByRole || {},
      waiters: staffByRole?.waiter || [],
      managers: staffByRole?.manager || [],
      admins: staffByRole?.admin || [],
    }
  };
}

// Helper function to format staff name and role
export function formatStaffInfo(staff: { full_name: string; role?: string | null }): string {
  const roleLabel = staff.role ? ` (${staff.role.charAt(0).toUpperCase() + staff.role.slice(1)})` : '';
  return `${staff.full_name}${roleLabel}`;
}