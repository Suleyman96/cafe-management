import type {
  MenuItemOptionInsert,
  MenuItemOptionUpdate,
  MenuItemOptionValueInsert,
  MenuItemOptionValueUpdate,
} from '@gustri/database/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateMenuItemOptions } from '../invalidation';
import { useDb, useTenantId } from '../provider';
import type { MutationCallbacks } from './types';

// Admin CRUD for a menu item's modifier groups and values. Each hook takes the
// owning `menuItemId` so the success path invalidates exactly that item's
// option set. Server-side authorization is RLS (admin/owner + tenant).

// ─── Option groups ───────────────────────────────────────────────────────────

export function useCreateMenuItemOption(menuItemId: string, options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MenuItemOptionInsert) => db.menuItemOptions.createOption(data),
    onSuccess: () => invalidateMenuItemOptions(queryClient, tenantId, menuItemId),
    onError: options?.onError,
  });
}

export function useUpdateMenuItemOption(menuItemId: string, options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<MenuItemOptionUpdate> }) =>
      db.menuItemOptions.updateOption(id, updates),
    onSuccess: () => invalidateMenuItemOptions(queryClient, tenantId, menuItemId),
    onError: options?.onError,
  });
}

export function useDeleteMenuItemOption(menuItemId: string, options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.menuItemOptions.deleteOption(id),
    onSuccess: () => invalidateMenuItemOptions(queryClient, tenantId, menuItemId),
    onError: options?.onError,
  });
}

// ─── Option values ───────────────────────────────────────────────────────────

export function useCreateMenuItemOptionValue(menuItemId: string, options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MenuItemOptionValueInsert) => db.menuItemOptions.createValue(data),
    onSuccess: () => invalidateMenuItemOptions(queryClient, tenantId, menuItemId),
    onError: options?.onError,
  });
}

export function useUpdateMenuItemOptionValue(menuItemId: string, options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<MenuItemOptionValueUpdate> }) =>
      db.menuItemOptions.updateValue(id, updates),
    onSuccess: () => invalidateMenuItemOptions(queryClient, tenantId, menuItemId),
    onError: options?.onError,
  });
}

export function useDeleteMenuItemOptionValue(menuItemId: string, options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.menuItemOptions.deleteValue(id),
    onSuccess: () => invalidateMenuItemOptions(queryClient, tenantId, menuItemId),
    onError: options?.onError,
  });
}
