'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRoutes } from '@/lib/api-routes';

/**
 * Whether the current user is a platform admin (gustri operator). Calls the
 * server gate (`/api/v1/platform/me`) once per session — the server is the real
 * authority; this only decides whether the UI offers the platform console. A
 * non-admin's call 403s and resolves to `false`.
 */
export function useIsPlatformAdmin(): boolean {
  const { data } = useQuery({
    queryKey: ['platform', 'me'],
    queryFn: () => apiRoutes.platform.me(),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  return data?.isPlatformAdmin === true;
}
