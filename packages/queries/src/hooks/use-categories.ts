import { QUERY_KEYS } from '@gustri/core';
import type { Category } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { useDb } from '../provider';

export function useCategories(options?: { isActive?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.CATEGORIES, options],
    queryFn: () => db.categories.findAll(options) as Promise<Category[]>,
  });
}
