import type { Category } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '../keys';
import { useDb } from '../provider';

export function useCategories(options?: { isActive?: boolean; initialData?: Category[] }) {
  const db = useDb();
  const initialData = options?.initialData;
  let filterOptions: { isActive?: boolean } | undefined;
  if (options) {
    const { initialData: _, ...rest } = options;
    filterOptions = Object.keys(rest).length > 0 ? rest : undefined;
  }
  return useQuery({
    queryKey: [QUERY_KEYS.CATEGORIES, filterOptions],
    queryFn: () => db.categories.findAll(filterOptions) as Promise<Category[]>,
    staleTime: 10 * 60 * 1000,
    ...(initialData ? { initialData } : {}),
  });
}
