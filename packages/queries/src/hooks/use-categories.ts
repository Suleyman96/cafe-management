import type { Category } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, tenantKey } from '../keys';
import { useDb, useTenantId } from '../provider';

export function useCategories(options?: {
  isActive?: boolean;
  initialData?: Category[];
  enabled?: boolean;
}) {
  const db = useDb();
  const tenantId = useTenantId();
  const initialData = options?.initialData;
  const enabled = options?.enabled ?? true;
  let filterOptions: { isActive?: boolean } | undefined;
  if (options) {
    const { initialData: _, enabled: __, ...rest } = options;
    filterOptions = Object.keys(rest).length > 0 ? rest : undefined;
  }
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.CATEGORIES, filterOptions),
    queryFn: () => db.categories.findAll(filterOptions) as Promise<Category[]>,
    staleTime: 10 * 60 * 1000,
    enabled,
    ...(initialData ? { initialData } : {}),
  });
}
