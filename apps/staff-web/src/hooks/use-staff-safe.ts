/**
 * Type-Safe Staff Hooks
 * Re-exports from @gustri/queries, with local composite hooks
 */

import { useStaff as useStaffShared } from '@gustri/queries';

// Re-export shared hooks
export {
  useActiveWaiters,
  useCreateStaff,
  useDeleteStaff,
  useStaff,
  useStaffByEmail,
  useStaffMember,
  useUpdateStaff,
} from '@gustri/queries';

// Composite hook: groups staff by role (app-specific)
export function useStaffByRole() {
  const { data: staff, ...rest } = useStaffShared();

  const staffByRole = staff?.reduce(
    (acc, member) => {
      const role = member.role || 'other';
      if (!acc[role]) {
        acc[role] = [];
      }
      acc[role].push(member);
      return acc;
    },
    {} as Record<string, typeof staff>,
  );

  return {
    ...rest,
    data: {
      all: staff || [],
      byRole: staffByRole || {},
      waiters: staffByRole?.waiter || [],
      admins: staffByRole?.admin || [],
      kitchen: staffByRole?.kitchen || [],
      owners: staffByRole?.owner || [],
    },
  };
}

// Helper function to format staff name and role
export function formatStaffInfo(staff: { full_name: string; role?: string | null }): string {
  const roleLabel = staff.role
    ? ` (${staff.role.charAt(0).toUpperCase() + staff.role.slice(1)})`
    : '';
  return `${staff.full_name}${roleLabel}`;
}
