import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiRoutes } from '@/lib/api-routes';
import { supabase } from '@/lib/supabase/client';

/**
 * Owner-only account closure. Calls the server soft-close route, then tears
 * down the local session — once the tenant is closed this session can no longer
 * read any data (RLS collapses `current_tenant_id()` to NULL), so staying on
 * the app would just show empty screens. Signs out and returns to /login.
 *
 * `-safe`-style hook (rule 1: server mutation via `apiRoutes` that the shared
 * hook can't express). App-local because closure is a web-only org action.
 */
export function useDeactivateTenant() {
  const router = useRouter();

  return useMutation({
    mutationFn: (reason?: string | null) =>
      apiRoutes.tenant.deactivate({ confirmation: 'CLOSE', reason: reason ?? null }),
    onSuccess: async () => {
      await supabase.auth.signOut();
      router.replace('/login');
    },
  });
}
