import type {
  CategoriesInsert,
  CategoriesUpdate,
  MenuItemsInsert,
  MenuItemsUpdate,
} from '@gustri/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateMenuAndCategories } from '../invalidation';
import { QUERY_KEYS, tenantKey } from '../keys';
import { useDb, useTenantId } from '../provider';
import type { MutationCallbacks } from './types';

// ─── Menu Items ─────────────────────────────────────────────────────────────

export function useCreateMenuItem(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MenuItemsInsert) => db.menuItems.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.MENU_ITEMS) });
    },
    onError: options?.onError,
  });
}

export function useUpdateMenuItem(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<MenuItemsUpdate> }) =>
      db.menuItems.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.MENU_ITEMS) });
    },
    onError: options?.onError,
  });
}

export function useDeleteMenuItem(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.menuItems.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.MENU_ITEMS) });
    },
    onError: options?.onError,
  });
}

export function useToggleMenuItemAvailability(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, currentAvailable }: { id: string; currentAvailable: boolean }) =>
      db.menuItems.toggleAvailability(id, currentAvailable),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.MENU_ITEMS) });
    },
    onError: options?.onError,
  });
}

// ─── Categories ─────────────────────────────────────────────────────────────

export function useCreateCategory(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CategoriesInsert) => db.categories.create(data),
    onSuccess: () => {
      invalidateMenuAndCategories(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}

export function useUpdateCategory(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CategoriesUpdate> }) =>
      db.categories.update(id, updates),
    onSuccess: () => {
      invalidateMenuAndCategories(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}

export function useDeleteCategory(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.categories.delete(id),
    onSuccess: () => {
      invalidateMenuAndCategories(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}
